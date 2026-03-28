import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const IMAGE_TYPES = ['image', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const OFFICE_TYPES = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'];

const iconBtn = "p-1 rounded-lg hover:bg-[var(--surface-high)] text-[var(--text-secondary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

const PdfViewer = ({ url }) => {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const pageRefs = useRef([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) setContainerWidth(entry.contentRect.width);
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !numPages) return;

    const scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page'), 10);
            if (!isNaN(pageNum)) setCurrentPage(pageNum);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );

    pageRefs.current.forEach((el) => { if (el) scrollObserver.observe(el); });
    return () => scrollObserver.disconnect();
  }, [numPages]);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    pageRefs.current = new Array(numPages).fill(null);
    setLoadError(false);
  }, []);

  const pageWidth = containerWidth > 8 ? (containerWidth - 8) * scale : undefined;

  if (loadError) {
    return (
      <div className="text-center p-6 text-[#ba1a1a] text-sm">Failed to load PDF. Please try again.</div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-low)] border-b border-[var(--outline)] flex-shrink-0">
        <span className="text-xs text-[var(--text-secondary)]">Page {currentPage} / {numPages ?? '…'}</span>
        <div className="flex items-center gap-1">
          <button className={iconBtn} onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))} disabled={scale <= 0.5}>
            <span className="material-symbols-outlined text-base">zoom_out</span>
          </button>
          <span className="text-xs text-[var(--text-secondary)] min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
          <button className={iconBtn} onClick={() => setScale((s) => Math.min(s + 0.25, 3.0))} disabled={scale >= 3.0}>
            <span className="material-symbols-outlined text-base">zoom_in</span>
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f0f2f5] flex flex-col items-center py-3 gap-3"
        onContextMenu={(e) => e.preventDefault()}
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => setLoadError(true)}
          loading={
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          {numPages && Array.from({ length: numPages }, (_, i) => (
            <div
              key={i + 1}
              data-page={i + 1}
              ref={(el) => { pageRefs.current[i] = el; }}
              className="shadow-md"
            >
              <Page pageNumber={i + 1} width={pageWidth} renderAnnotationLayer={false} renderTextLayer={false} />
            </div>
          ))}
        </Document>
      </div>
    </>
  );
};

const ImageViewer = ({ url }) => (
  <div
    className="flex-1 overflow-auto flex justify-center items-start p-4 bg-[#f0f2f5]"
    onContextMenu={(e) => e.preventDefault()}
  >
    <img
      src={url}
      alt="Document"
      className="max-w-full object-contain select-none pointer-events-none"
      draggable={false}
    />
  </div>
);

const OfficeViewer = ({ url }) => {
  const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <iframe
        src={viewerUrl}
        className="flex-1 w-full h-full border-0"
        title="Document Viewer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
};

const DocumentViewer = ({ url, fileType }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const normalizedType = (fileType || '').toLowerCase().replace('.', '');
  const isImage = IMAGE_TYPES.includes(normalizedType);
  const isOffice = OFFICE_TYPES.includes(normalizedType);
  const isPdf = !isImage && !isOffice;

  return (
    <div
      ref={wrapperRef}
      className={`flex flex-col w-full h-full select-none ${isFullscreen ? 'bg-[#f0f2f5]' : ''}`}
    >
      <div className="flex items-center justify-end px-2 py-1 bg-[var(--surface-low)] border-b border-[var(--outline)] rounded-t-lg flex-shrink-0">
        <button onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} className={iconBtn}>
          <span className="material-symbols-outlined text-base">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
      </div>

      {isPdf && <PdfViewer url={url} />}
      {isImage && <ImageViewer url={url} />}
      {isOffice && <OfficeViewer url={url} />}
    </div>
  );
};

export default DocumentViewer;
