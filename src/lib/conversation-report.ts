/**
 * @fileOverview 실시간 대화 도구의 PDF(인쇄) 리포트 생성.
 *
 * 두 도구가 같은 형식을 쓰므로 한곳에 모읍니다.
 * 기존 구현은 대화 스크립트를 <pre> 로 넣으면서 줄바꿈 설정을 하지 않아
 * 긴 문장이 인쇄 폭을 넘어가면 그대로 잘렸습니다.
 */

export type ConversationReport = {
  title: string;
  /** 리포트 상단에 표시할 부제 (예: 평가 모델명) */
  subtitle?: string;
  overallScore: number;
  grammarFeedback: string;
  fluencyFeedback: string;
  overallFeedback: string;
  transcript: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * AI 총평은 마크다운으로 오는데 그대로 넣으면 '**강점**' 같은 기호가 노출되고
 * 줄바꿈이 사라집니다. 인쇄물에 필요한 최소한만 변환합니다.
 */
function renderMarkdown(markdown: string): string {
  return escapeHtml(markdown)
    .replace(/^#{1,6}\s*(.+)$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n/g, '<br/>');
}

export function buildConversationReportHtml(report: ConversationReport): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(report.title)}</title>
    <style>
      body {
        font-family: 'Malgun Gothic', sans-serif;
        line-height: 1.6;
        padding: 20px;
        color: #333;
      }
      h1, h2, h3 { color: #111; }
      /* 인쇄 폭을 넘는 긴 문장이 잘리지 않도록 줄을 접습니다. */
      pre, .body-text {
        white-space: pre-wrap;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      pre {
        font-family: inherit;
        background: #f7f7f7;
        padding: 12px;
        border-radius: 6px;
      }
      @media print {
        /* 제목만 남고 내용이 다음 장으로 넘어가는 것을 막습니다. */
        h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
        p, li { orphans: 2; widows: 2; }
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(report.title)}</h1>
    ${report.subtitle ? `<p>${escapeHtml(report.subtitle)}</p>` : ''}
    <p><strong>총점:</strong> ${report.overallScore} / 100</p>

    <h3>문법 및 어휘 (Grammar)</h3>
    <div class="body-text">${escapeHtml(report.grammarFeedback)}</div>

    <h3>유창성 (Fluency)</h3>
    <div class="body-text">${escapeHtml(report.fluencyFeedback)}</div>

    <h3>총평 (Overall)</h3>
    <div class="body-text">${renderMarkdown(report.overallFeedback)}</div>

    <h3>전체 대화 스크립트</h3>
    <pre>${escapeHtml(report.transcript)}</pre>

    <script>
      // 레이아웃과 폰트가 준비된 뒤에 인쇄해야 내용이 밀리지 않습니다.
      window.onload = function () {
        window.print();
        window.close();
      };
    </script>
  </body>
</html>`;
}

/** 새 창을 열어 리포트를 인쇄합니다. 팝업이 차단되면 false 를 돌려줍니다. */
export function printConversationReport(report: ConversationReport): boolean {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  printWindow.document.write(buildConversationReportHtml(report));
  printWindow.document.close();
  return true;
}
