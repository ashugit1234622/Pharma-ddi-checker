'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Upload, Camera, Loader2, X, FileText, CheckCircle2, AlertTriangle, Zap, Info, ChevronsDown } from 'lucide-react';

type PrescScanState = 'idle' | 'camera_active' | 'processing' | 'result' | 'error';

export interface PrescribedMedicine {
  name: string;
  genericName?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface PrescriptionResult {
  patient?: string;
  date?: string;
  doctor?: string;
  clinic?: string;
  medicines: PrescribedMedicine[];
  rawInstructions?: string;
  confidence?: 'High' | 'Medium' | 'Low';
}

interface Props {
  onCheckInteraction: (drug1: string, drug2: string) => void;
}

export default function PrescriptionScanner({ onCheckInteraction }: Props) {
  const [scanState, setScanState] = useState<PrescScanState>('idle');
  const [result, setResult] = useState<PrescriptionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [arRect, setArRect] = useState({ top: 0.12, left: 0.08, right: 0.08, bottom: 0.12 });
  const [selectedPair, setSelectedPair] = useState<[number, number] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const arCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const arAnimRef = useRef<number | null>(null);
  const detectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const arRectRef = useRef(arRect);

  useEffect(() => { arRectRef.current = arRect; }, [arRect]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => () => stopCamera(), []);

  /* ── Camera helpers ── */
  const stopCamera = () => {
    if (arAnimRef.current) cancelAnimationFrame(arAnimRef.current);
    if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
    arAnimRef.current = null;
    detectIntervalRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      setScanState('camera_active');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      const vid = videoRef.current!;
      vid.srcObject = stream;
      await vid.play();
      vid.onloadedmetadata = () => {
        startArOverlay();
        startEdgeDetection();
      };
    } catch {
      setScanState('idle');
      setErrorMsg('Camera access denied or unavailable.');
    }
  };

  const startArOverlay = () => {
    const draw = () => {
      const canvas = arCanvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const w = canvas.width = canvas.offsetWidth;
      const h = canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, w, h);

      const r = arRectRef.current;
      const x = r.left * w, y = r.top * h;
      const rw = w - r.left * w - r.right * w;
      const rh = h - r.top * h - r.bottom * h;

      /* Vignette */
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.clearRect(x, y, rw, rh);
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(x, y, rw, rh);

      /* Corner brackets */
      const cLen = Math.min(rw, rh) * 0.13;
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 10;

      [[x, y, 1, 1], [x + rw, y, -1, 1], [x, y + rh, 1, -1], [x + rw, y + rh, -1, -1]].forEach(([cx, cy, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(cx + dx * cLen, cy as number);
        ctx.lineTo(cx as number, cy as number);
        ctx.lineTo(cx as number, cy + dy * cLen);
        ctx.stroke();
      });

      /* Animated pulsing border */
      const alpha = 0.25 + 0.2 * Math.sin(Date.now() / 500);
      ctx.strokeStyle = `rgba(99,102,241,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 4;
      ctx.strokeRect(x + 1, y + 1, rw - 2, rh - 2);

      /* Guide text */
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Align prescription within border', w / 2, y - 10);

      arAnimRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const startEdgeDetection = () => {
    detectIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const cap = captureCanvasRef.current;
      if (!video || !cap || video.readyState < 2) return;

      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const scale = 0.12;
      cap.width = Math.floor(vw * scale);
      cap.height = Math.floor(vh * scale);
      const ctx = cap.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, cap.width, cap.height);
      const img = ctx.getImageData(0, 0, cap.width, cap.height).data;
      const W = cap.width, H = cap.height;

      const rowBright = (row: number) => {
        let s = 0;
        for (let x = 0; x < W; x++) { const i = (row * W + x) * 4; s += (img[i] + img[i+1] + img[i+2]) / 3; }
        return s / W;
      };
      const colBright = (col: number) => {
        let s = 0;
        for (let y = 0; y < H; y++) { const i = (y * W + col) * 4; s += (img[i] + img[i+1] + img[i+2]) / 3; }
        return s / H;
      };

      const thr = 50;
      let top = 0.12, bottom = 0.12, left = 0.08, right = 0.08;
      for (let r = 0; r < H * 0.5; r++) { if (rowBright(r) > thr) { top = Math.max(0.04, r / H - 0.02); break; } }
      for (let r = H - 1; r > H * 0.5; r--) { if (rowBright(r) > thr) { bottom = Math.max(0.04, (H - r) / H - 0.02); break; } }
      for (let c = 0; c < W * 0.5; c++) { if (colBright(c) > thr) { left = Math.max(0.03, c / W - 0.02); break; } }
      for (let c = W - 1; c > W * 0.5; c--) { if (colBright(c) > thr) { right = Math.max(0.03, (W - c) / W - 0.02); break; } }

      setArRect(prev => ({
        top: prev.top * 0.8 + top * 0.2,
        bottom: prev.bottom * 0.8 + bottom * 0.2,
        left: prev.left * 0.8 + left * 0.2,
        right: prev.right * 0.8 + right * 0.2,
      }));
    }, 500);
  };

  const captureAndProcess = async () => {
    const video = videoRef.current;
    const cap = captureCanvasRef.current;
    if (!video || !cap) return;
    cap.width = video.videoWidth || 1280;
    cap.height = video.videoHeight || 720;
    const ctx = cap.getContext('2d')!;
    ctx.drawImage(video, 0, 0, cap.width, cap.height);
    stopCamera();
    const base64 = cap.toDataURL('image/jpeg', 0.85).split(',')[1];
    await sendToApi(base64);
  };

  const sendToApi = async (base64: string) => {
    setScanState('processing');
    setErrorMsg('');
    try {
      const res = await fetch('/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setScanState('error');
        setErrorMsg(data.error || 'Could not read the prescription.');
        return;
      }
      setResult(data);
      setScanState('result');
    } catch {
      setScanState('error');
      setErrorMsg('Network error. Please try again.');
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      sendToApi(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFileUpload(file);
  };

  const reset = () => {
    stopCamera(); setScanState('idle'); setResult(null); setErrorMsg('');
    setArRect({ top: 0.12, left: 0.08, right: 0.08, bottom: 0.12 }); setSelectedPair(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInteractionCheck = () => {
    if (!result || !selectedPair) return;
    const [i, j] = selectedPair;
    const d1 = result.medicines[i]?.genericName || result.medicines[i]?.name || '';
    const d2 = result.medicines[j]?.genericName || result.medicines[j]?.name || '';
    if (d1 && d2) onCheckInteraction(d1, d2);
  };

  /* ── Render ── */
  return (
    <div className="presc-scanner">
      {/* Hidden capture canvas */}
      <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

      {/* ── Idle / Camera / Processing ── */}
      {(scanState === 'idle' || scanState === 'camera_active') && (
        <div className="presc-scan-view">
          <p className="medcheck-instruction">
            Upload or photograph a prescription to extract medicines and check interactions.
          </p>

          {/* Camera view */}
          {scanState === 'camera_active' ? (
            <div className="presc-camera-wrapper">
              <video ref={videoRef} className="presc-video" playsInline muted />
              <canvas ref={arCanvasRef} className="presc-ar-canvas" />
              <button className="presc-shutter-btn" onClick={captureAndProcess} aria-label="Capture prescription">
                <span className="presc-shutter-inner" />
              </button>
              <button className="presc-cancel-btn" onClick={() => { stopCamera(); setScanState('idle'); }}>
                <X size={18} /> Cancel
              </button>
            </div>
          ) : (
            /* Drop zone */
            <div
              className={`presc-dropzone ${isDragging ? 'presc-dropzone-drag' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="presc-dropzone-content">
                <FileText size={44} className="presc-dropzone-icon" />
                <span className="presc-dropzone-title">Upload Prescription</span>
                <span className="presc-dropzone-hint">
                  {isMobile ? 'Tap to choose a photo or file' : 'Drag & drop or click to browse'}
                </span>
                <span className="presc-dropzone-formats">PNG, JPG, WEBP · PDF not supported</span>
              </div>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/jpg,image/webp"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />

          {/* Mobile camera button */}
          {isMobile && scanState === 'idle' && (
            <button className="btn btn-primary btn-full presc-camera-btn" onClick={startCamera}>
              <Camera size={20} /> Live Camera
            </button>
          )}
        </div>
      )}

      {/* Processing */}
      {scanState === 'processing' && (
        <div className="presc-processing">
          <div className="presc-processing-icon">
            <Loader2 size={52} className="presc-spin text-accent" />
          </div>
          <h3>Reading Prescription…</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Gemini AI is extracting medicine details</p>
        </div>
      )}

      {/* Error */}
      {scanState === 'error' && (
        <div className="presc-result-card presc-error">
          <div className="presc-result-top">
            <AlertTriangle size={28} style={{ color: 'var(--danger)' }} />
            <h3>Could not read prescription</h3>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '0 1.5rem 1.5rem', fontSize: '0.9rem' }}>{errorMsg}</p>
          <div className="presc-result-actions">
            <button className="btn btn-primary" onClick={reset}>Try Again</button>
          </div>
        </div>
      )}

      {/* Result */}
      {scanState === 'result' && result && (
        <div className="presc-result-card">
          {/* Header row */}
          <div className="presc-result-header">
            <div className="presc-result-badge">
              <CheckCircle2 size={14} /> Prescription Read
            </div>
            {result.confidence && (
              <div className={`confidence-badge confidence-${result.confidence.toLowerCase()}`}>
                {result.confidence} Confidence
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="presc-meta-grid">
            {result.patient && <div className="presc-meta-item"><span className="field-label">Patient</span><span className="field-value">{result.patient}</span></div>}
            {result.doctor && <div className="presc-meta-item"><span className="field-label">Doctor</span><span className="field-value">{result.doctor}</span></div>}
            {result.clinic && <div className="presc-meta-item"><span className="field-label">Clinic</span><span className="field-value">{result.clinic}</span></div>}
            {result.date && <div className="presc-meta-item"><span className="field-label">Date</span><span className="field-value">{result.date}</span></div>}
          </div>

          {/* Medicines */}
          {result.medicines.length > 0 ? (
            <div className="presc-medicines">
              <div className="presc-medicines-title">
                <FileText size={16} style={{ color: 'var(--accent-primary)' }} />
                Prescribed Medicines ({result.medicines.length})
                {result.medicines.length >= 2 && (
                  <span className="presc-select-hint">Select two to check interactions</span>
                )}
              </div>
              <div className="presc-medicines-list">
                {result.medicines.map((med, idx) => {
                  const isSelected = selectedPair?.includes(idx);
                  return (
                    <div
                      key={idx}
                      className={`presc-med-card ${isSelected ? 'presc-med-selected' : ''}`}
                      onClick={() => {
                        if (result.medicines.length < 2) return;
                        setSelectedPair(prev => {
                          if (!prev) return [idx, -1] as any;
                          const [a, b] = prev;
                          if (a === idx) return b !== -1 ? [b, -1] as any : null;
                          if (b === idx) return [a, -1] as any;
                          if (a === -1 || b === -1) {
                            const other = a === -1 ? b : a;
                            return other === idx ? null : [Math.min(other, idx), Math.max(other, idx)] as [number, number];
                          }
                          return [a, idx] as [number, number];
                        });
                      }}
                    >
                      <div className="presc-med-header">
                        <div>
                          <div className="presc-med-name">{med.name}</div>
                          {med.genericName && med.genericName !== med.name && (
                            <div className="presc-med-generic">{med.genericName}</div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="presc-med-check"><CheckCircle2 size={16} /></div>
                        )}
                      </div>
                      <div className="presc-med-details">
                        {med.dose && <span className="presc-med-pill">{med.dose}</span>}
                        {med.frequency && <span className="presc-med-pill">{med.frequency}</span>}
                        {med.duration && <span className="presc-med-pill">{med.duration}</span>}
                      </div>
                      {med.instructions && (
                        <div className="presc-med-note"><Info size={12} /> {med.instructions}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Interaction CTA — appears when 2 valid medicines selected */}
              {selectedPair && selectedPair[0] !== -1 && selectedPair[1] !== -1 && selectedPair[1] !== undefined && (
                <button className="presc-interaction-btn btn btn-primary" onClick={handleInteractionCheck}>
                  <Zap size={18} />
                  Check Interaction: {result.medicines[selectedPair[0]]?.name} ↔ {result.medicines[selectedPair[1]]?.name}
                </button>
              )}
            </div>
          ) : (
            <div className="presc-no-meds">
              <AlertTriangle size={24} style={{ color: 'var(--warning)', marginBottom: '0.5rem' }} />
              <p>No medicines could be extracted. Please try a clearer image.</p>
            </div>
          )}

          {/* General instructions */}
          {result.rawInstructions && (
            <div className="ai-summary-box" style={{ margin: '0 1.5rem 1.5rem' }}>
              <div className="ai-summary-header"><Info size={15} className="text-accent" /><span>General Instructions</span></div>
              <p className="ai-summary-text">{result.rawInstructions}</p>
            </div>
          )}

          <div className="presc-result-actions">
            <button className="btn btn-secondary" onClick={reset}>Scan Another</button>
          </div>
        </div>
      )}
    </div>
  );
}
