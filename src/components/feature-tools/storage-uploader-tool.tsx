
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, CheckCircle, LinkIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAuth } from '@/context/auth-context';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function StorageUploaderTool() {
    const [uploadState, setUploadState] = useState<UploadState>('idle');
    const [file, setFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [downloadURL, setDownloadURL] = useState<string | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setUploadState('idle');
            setDownloadURL(null);
            setUploadProgress(0);
        }
    };

    const handleUpload = async () => {
        if (!file || !user) {
            toast({
                title: "파일 또는 사용자 없음",
                description: "업로드할 파일을 선택하고 로그인했는지 확인해주세요.",
                variant: "destructive"
            });
            return;
        }

        setUploadState('uploading');
        setUploadProgress(0);
        setDownloadURL(null);

        const storageRef = ref(storage, `uploads/${user.uid}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload failed:", error);
                toast({
                    title: "업로드 실패",
                    description: "파일을 업로드하는 중 오류가 발생했습니다.",
                    variant: "destructive"
                });
                setUploadState('error');
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((url) => {
                    setDownloadURL(url);
                    setUploadState('success');
                    toast({
                        title: "업로드 성공!",
                        description: "파일이 성공적으로 Storage에 저장되었습니다."
                    });
                });
            }
        );
    };

    const handleCopyUrl = () => {
        if (downloadURL) {
            navigator.clipboard.writeText(downloadURL);
            toast({ title: "URL 복사됨", description: "파일 다운로드 URL이 클립보드에 복사되었습니다." });
        }
    };

    return (
        <CardContent className="pt-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="storage-file-upload" className="text-sm font-medium">파일 선택</label>
                    <Input id="storage-file-upload" type="file" onChange={handleFileChange} />
                    {file && <p className="text-sm text-muted-foreground">선택된 파일: {file.name} ({(file.size / 1024).toFixed(2)} KB)</p>}
                </div>

                <Button onClick={handleUpload} disabled={!file || uploadState === 'uploading'} className="w-full">
                    {uploadState === 'uploading' ? (
                        <Loader2 className="mr-2 animate-spin" />
                    ) : (
                        <UploadCloud className="mr-2" />
                    )}
                    {uploadState === 'uploading' ? '업로드 중...' : 'Storage에 업로드'}
                </Button>

                {uploadState === 'uploading' && (
                    <Progress value={uploadProgress} className="w-full" />
                )}

                {uploadState === 'success' && downloadURL && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <h4 className="font-semibold text-green-800">업로드 완료</h4>
                        </div>
                        <p className="text-sm text-green-700">파일이 성공적으로 업로드되었습니다. 아래 링크로 접근할 수 있습니다.</p>
                        <div className="flex items-center gap-2 p-2 bg-white rounded-md border">
                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                            <a href={downloadURL} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 truncate hover:underline">
                                {downloadURL}
                            </a>
                            <Button size="sm" variant="ghost" onClick={handleCopyUrl} className="ml-auto">복사</Button>
                        </div>
                    </div>
                )}
            </div>
        </CardContent>
    );
}
