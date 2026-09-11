import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';

export function BarcodeScannerModal({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, controls) => {
        controlsRef.current = controls;
        if (result && !cancelled) {
          cancelled = true;
          controls.stop();
          onDetected(result.getText());
        }
      })
      .catch(() => {
        setError("Impossible d'accéder à la caméra. Vérifie les autorisations du navigateur.");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2>Scanner un code</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        {error ? (
          <div className="alert error">{error}</div>
        ) : (
          <>
            <div className="scanner-frame">
              <video ref={videoRef} muted playsInline />
            </div>
            <p className="hint" style={{ marginTop: 10 }}>
              Vise l'étiquette (QR code) du lot avec la caméra. La vente se complète automatiquement dès qu'un code
              valide est détecté.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
