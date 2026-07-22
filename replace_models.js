const fs = require('fs');
const path = require('path');

const TARGET_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const DIRS_TO_SCAN = ['src', 'workspace'];

function walkDir(dir) {
    let results = [];
    try {
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(walkDir(file));
            } else {
                if (TARGET_EXTENSIONS.includes(path.extname(file))) {
                    results.push(file);
                }
            }
        });
    } catch (e) { }
    return results;
}

function replaceInFile(filePath) {
    const original = fs.readFileSync(filePath, 'utf8');

    // Fix the prefix match issue
    let modified = original.replaceAll('gemini-3.6-flash-lite', 'gemini-3.5-flash-lite');

    if (original !== modified) {
        fs.writeFileSync(filePath, modified, 'utf8');
        console.log(`Updated models in: ${filePath}`);
    }
}

DIRS_TO_SCAN.forEach(dir => {
    const files = walkDir(dir);
    files.forEach(replaceInFile);
});
console.log("Replacement complete.");
