// App.js — From Negative Redesigned
// Registration → Capture → Analyze → Single-page Report (no tabs, no history)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = '';

// ── FACE DETECTION ──
function useFaceDetection(videoRef, isActive) {
  const [hasFace, setHasFace] = useState(false);
  const [facePos, setFacePos] = useState('none');
  const [faceBox, setFaceBox] = useState(null);
  const [headAngle, setHeadAngle] = useState('center');
  const detRef = useRef(null);
  const native = useRef(false);

  useEffect(() => {
    if (!isActive) { setHasFace(false); setFacePos('none'); return; }
    if (window.FaceDetector) {
      try { detRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); native.current = true; }
      catch { native.current = false; }
    }
    const detect = async () => {
      const v = videoRef.current;
      if (!v || v.readyState !== 4) return;
      try {
        if (detRef.current && native.current) {
          const faces = await detRef.current.detect(v);
          if (faces.length > 0) {
            const f = faces[0].boundingBox, vw = v.videoWidth, vh = v.videoHeight;
            const cx = (f.x + f.width / 2) / vw, cy = (f.y + f.height / 2) / vh, ratio = f.width / vw;
            setHasFace(true); setFaceBox({ cx, cy, ratio });
            setFacePos(ratio > 0.65 ? 'too-close' : ratio < 0.08 ? 'too-far' : 'centered');
            setHeadAngle(cx < 0.32 ? 'turned-right' : cx > 0.68 ? 'turned-left' : cx < 0.42 ? 'slight-right' : cx > 0.58 ? 'slight-left' : 'center');
          } else { setHasFace(false); setFacePos('none'); setFaceBox(null); setHeadAngle('center'); }
        } else {
          const c = document.createElement('canvas'); c.width = 120; c.height = 90;
          const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0, 120, 90);
          const d = ctx.getImageData(20, 10, 80, 70); let skin = 0;
          for (let i = 0; i < d.data.length; i += 16) {
            const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
            if (r > 50 && g > 25 && b > 10 && r > g && (r - b) > 8) skin++;
          }
          const detected = skin / (d.data.length / 16) > 0.08;
          setHasFace(detected); setFacePos(detected ? 'centered' : 'none');
          setFaceBox(detected ? { cx: 0.5, cy: 0.45, ratio: 0.3 } : null);
          if (detected) {
            const ld = ctx.getImageData(10, 15, 40, 60), rd = ctx.getImageData(70, 15, 40, 60);
            let ls = 0, rs = 0;
            for (let i = 0; i < ld.data.length; i += 16) { if (ld.data[i] > 50 && ld.data[i + 1] > 25 && ld.data[i] > ld.data[i + 1]) ls++; }
            for (let i = 0; i < rd.data.length; i += 16) { if (rd.data[i] > 50 && rd.data[i + 1] > 25 && rd.data[i] > rd.data[i + 1]) rs++; }
            const lp = ls / ((ls + rs) || 1);
            setHeadAngle(lp > 0.62 ? 'slight-right' : lp < 0.38 ? 'slight-left' : 'center');
          } else setHeadAngle('center');
        }
      } catch { }
    };
    const iv = setInterval(detect, 400);
    return () => clearInterval(iv);
  }, [isActive, videoRef]);
  return { hasFace, facePos, faceBox, headAngle };
}

// ── FACE GUIDE ──
function FaceGuide({ hasFace, facePos, targetAngle, faceBox, canCapture }) {
  const color = !hasFace ? '#c44040' : canCapture ? '#2d8a4e' : '#c17f24';
  const msg = !hasFace ? 'Position your face in frame'
    : facePos === 'too-close' ? 'Move back a bit'
      : facePos === 'too-far' ? 'Come a little closer'
        : canCapture ? 'Ready — tap capture'
          : targetAngle === 'left' ? 'Turn head to the left'
            : targetAngle === 'right' ? 'Turn head to the right'
              : 'Face the camera straight';
  const ox = faceBox ? (faceBox.cx - 0.5) * 35 : 0;
  const oy = faceBox ? (faceBox.cy - 0.45) * 25 : 0;
  const sc = faceBox ? Math.min(Math.max(faceBox.ratio / 0.28, 0.8), 1.25) : 1;
  return (
    <div className="face-guide">
      <svg viewBox="0 0 300 380" className={`guide-svg ${canCapture ? 'ready' : ''}`}
        style={{ transform: `translate(${ox}px,${oy}px) scale(${sc})`, transition: 'transform .25s ease-out' }}>
        <defs><filter id="gl"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <ellipse cx="150" cy="155" rx="78" ry="102" fill="none" stroke={color}
          strokeWidth={canCapture ? 3 : 1.8} strokeDasharray={canCapture ? 'none' : '10,7'}
          opacity={canCapture ? 1 : 0.45} filter={canCapture ? 'url(#gl)' : 'none'} style={{ transition: 'all .35s' }} />
        {targetAngle === 'front' && <g opacity="0.15" stroke={color} strokeWidth="0.7"><line x1="150" y1="70" x2="150" y2="240" /><line x1="78" y1="155" x2="222" y2="155" /></g>}
        {targetAngle === 'left' && <g opacity={canCapture ? 0.9 : 0.5}><path d="M82 105Q52 155 82 210" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={canCapture ? 'none' : '5,4'} /><polygon points="77,103 87,103 82,90" fill={color} /><text x="36" y="162" fill={color} fontSize="16" fontWeight="700">45°</text></g>}
        {targetAngle === 'right' && <g opacity={canCapture ? 0.9 : 0.5}><path d="M218 105Q248 155 218 210" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={canCapture ? 'none' : '5,4'} /><polygon points="213,103 223,103 218,90" fill={color} /><text x="245" y="162" fill={color} fontSize="16" fontWeight="700">45°</text></g>}
        {canCapture && <ellipse cx="150" cy="155" rx="88" ry="112" fill="none" stroke={color} strokeWidth="1" opacity="0.35">
          <animate attributeName="rx" values="86;93;86" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="ry" values="110;117;110" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0.08;0.35" dur="2.2s" repeatCount="indefinite" />
        </ellipse>}
      </svg>
      <div className={`guide-msg ${canCapture ? 'ok' : !hasFace ? 'err' : 'warn'}`}><span>{msg}</span></div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════
function App() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('derma-theme') || 'light'; } catch { return 'light'; }
  });
  const [step, setStep] = useState('intro'); // intro → register → capture → analyzing → results
  const [userInfo, setUserInfo] = useState({ phone: '' });
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [images, setImages] = useState({});
  const [curAngle, setCurAngle] = useState('front');
  const [quality, setQuality] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [camReady, setCamReady] = useState(false);
  const [aStep, setAStep] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [overrideReady, setOverrideReady] = useState(false);

  const overTimer = useRef(null);
  const vidRef = useRef(null);
  const canRef = useRef(null);
  const stmRef = useRef(null);

  const { hasFace, facePos, faceBox, headAngle } = useFaceDetection(vidRef, step === 'capture' && camReady);
  const angles = [
    { id: 'front', label: 'Front', desc: 'Look directly at the camera' },
    { id: 'left', label: 'Left 45°', desc: 'Turn your head 45° left' },
    { id: 'right', label: 'Right 45°', desc: 'Turn your head 45° right' }
  ];

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); try { localStorage.setItem('derma-theme', theme); } catch { } }, [theme]);

  const isAngleOk = () => {
    if (!hasFace || facePos === 'too-close' || facePos === 'too-far') return false;
    if (curAngle === 'front') return ['center', 'slight-left', 'slight-right'].includes(headAngle);
    if (curAngle === 'left') return ['turned-left', 'slight-left', 'center'].includes(headAngle);
    if (curAngle === 'right') return ['turned-right', 'slight-right', 'center'].includes(headAngle);
    return false;
  };
  const canCap = camReady && hasFace && facePos !== 'too-close' && facePos !== 'too-far' && (isAngleOk() || overrideReady);

  useEffect(() => {
    setOverrideReady(false);
    if (overTimer.current) clearTimeout(overTimer.current);
    if (hasFace && facePos !== 'too-close' && facePos !== 'too-far' && !isAngleOk()) {
      overTimer.current = setTimeout(() => setOverrideReady(true), 4000);
    }
    return () => { if (overTimer.current) clearTimeout(overTimer.current); };
  }, [hasFace, facePos, headAngle, curAngle]); // eslint-disable-line

  useEffect(() => setOverrideReady(false), [curAngle]);
  useEffect(() => { return () => { if (stmRef.current) stmRef.current.getTracks().forEach(t => t.stop()); }; }, []);

  // ── Registration ──
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    const { phone } = userInfo;
    if (!phone.trim() || phone.replace(/\D/g, '').length < 7) return setRegError('Please enter a valid phone number');

    setRegLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/register-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Registration failed');
      startCam();
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  // ── Camera ──
  const startCam = async () => {
    try {
      if (stmRef.current) stmRef.current.getTracks().forEach(t => t.stop());
      setCamReady(false); setError(null);
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280, min: 480 }, height: { ideal: 720, min: 360 }, facingMode: 'user' }
      });
      stmRef.current = ms; setStep('capture');
      setTimeout(() => {
        if (vidRef.current) {
          vidRef.current.srcObject = ms;
          vidRef.current.onloadedmetadata = () => vidRef.current.play().then(() => setCamReady(true)).catch(() => setError('Video failed'));
        }
      }, 120);
    } catch (e) { setError(e.name === 'NotAllowedError' ? 'Camera access denied.' : `Camera error: ${e.message}`); }
  };

  useEffect(() => {
    if (step === 'capture' && vidRef.current && stmRef.current && !vidRef.current.srcObject) {
      vidRef.current.srcObject = stmRef.current;
      vidRef.current.onloadedmetadata = () => vidRef.current.play().then(() => setCamReady(true)).catch(console.error);
    }
  }, [step]);

  const stopCam = useCallback(() => {
    if (stmRef.current) { stmRef.current.getTracks().forEach(t => t.stop()); stmRef.current = null; }
    if (vidRef.current) vidRef.current.srcObject = null;
    setCamReady(false);
  }, []);

  // Quality check loop
  useEffect(() => {
    if (step !== 'capture' || !camReady) return;
    const iv = setInterval(async () => {
      try {
        const c = canRef.current, v = vidRef.current;
        if (!c || !v || v.readyState !== 4) return;
        c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.5));
        if (!blob) return;
        const fd = new FormData();
        fd.append('image', new File([blob], 'q.jpg', { type: 'image/jpeg' }));
        const res = await fetch(`${API_URL}/api/check-quality`, { method: 'POST', body: fd });
        if (res.ok) setQuality(await res.json());
      } catch { }
    }, 3500);
    return () => clearInterval(iv);
  }, [step, camReady]);

  const capture = () => {
    if (!canCap) return;
    const c = canRef.current, v = vidRef.current;
    if (!c || !v || v.readyState !== 4) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const url = c.toDataURL('image/jpeg', 0.92);
    const next = { ...images, [curAngle]: url };
    setImages(next); setOverrideReady(false);
    const idx = angles.findIndex(a => a.id === curAngle);
    if (idx < angles.length - 1) setCurAngle(angles[idx + 1].id);
    else { stopCam(); doAnalyze(next); }
  };

  const retake = (id) => { setImages(p => { const n = { ...p }; delete n[id]; return n; }); setCurAngle(id); };

  // ── Analyze ──
  const doAnalyze = async (imgs) => {
    const src = imgs || images;
    setStep('analyzing'); setError(null); setAStep(0);
    const t1 = setTimeout(() => setAStep(1), 1200);
    const t2 = setTimeout(() => setAStep(2), 3500);
    const t3 = setTimeout(() => setAStep(3), 5500);
    try {
      if (!src.front) throw new Error('Front view required');
      const b = atob(src.front.split(',')[1]);
      const a = new Uint8Array(b.length);
      for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
      const fd = new FormData();
      fd.append('image', new File([a], 'skin.jpg', { type: 'image/jpeg' }));
      fd.append('phone', userInfo.phone || '');
      // Send all 3 angle images as base64 for PDF generation
      if (src.front) fd.append('img_front', src.front);
      if (src.left) fd.append('img_left', src.left);
      if (src.right) fd.append('img_right', src.right);
      const res = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Analysis failed'); }
      const data = await res.json();
      setAnalysis({ ...data.analysis, _images: src, _reportId: data.reportId });
      setStep('results');
    } catch (e) { setError(e.message); setStep('intro'); }
    finally { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); }
  };

  // ── PDF ──
  const downloadPdf = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/generate-report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          images: analysis._images,
          userInfo,
          reportId: analysis._reportId
        })
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `Skin_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click(); URL.revokeObjectURL(url);
    } catch (e) { setError('PDF: ' + e.message); }
    finally { setPdfLoading(false); }
  };

  const share = (via) => {
    const text = `Negative Skin Report\nScore: ${analysis?.overallScore}/100\nType: ${analysis?.skinType}\nDate: ${new Date().toLocaleDateString()}\n\nConditions: ${(analysis?.detectedIssues || []).map(i => i.issue).join(', ') || 'None'}\n\nGenerated by Negative`;
    if (via === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    else if (via === 'email') window.open(`mailto:?subject=My Skin Analysis Report&body=${encodeURIComponent(text)}`, '_blank');
    else { navigator.clipboard?.writeText(text); setError('Copied to clipboard!'); setTimeout(() => setError(null), 2000); }
  };

  const reset = () => {
    stopCam(); setImages({}); setCurAngle('front'); setAnalysis(null);
    setError(null); setQuality(null); setCamReady(false); setStep('intro');
    setOverrideReady(false);
  };

  const cur = angles.find(a => a.id === curAngle);
  const shutterLabel = !camReady ? 'Starting...' : !hasFace ? 'No face detected'
    : facePos === 'too-close' ? 'Move back' : facePos === 'too-far' ? 'Come closer'
      : canCap ? "Let's Capture" : curAngle === 'left' ? 'Turn head left...'
        : curAngle === 'right' ? 'Turn head right...' : 'Face the camera...';

  const scoreColor = (s) => s >= 70 ? 'var(--green)' : s >= 40 ? 'var(--amber)' : 'var(--red)';
  const productColors = {
    cleanser: { bg: '#dbeafe', fg: '#1d4ed8' }, serum: { bg: '#fce7f3', fg: '#be185d' },
    moisturizer: { bg: '#dcfce7', fg: '#15803d' }, sunscreen: { bg: '#fef3c7', fg: '#b45309' },
    treatment: { bg: '#e0e7ff', fg: '#4338ca' }, exfoliant: { bg: '#fee2e2', fg: '#b91c1c' },
    retinoid: { bg: '#f3e8ff', fg: '#7c3aed' }, toner: { bg: '#e0f2fe', fg: '#0369a1' },
  };

  return (
    <div className="app">

      {/* ═══ INTRO ═══ */}
      {step === 'intro' && (
        <div className="screen intro">
          <div className="intro-inner">
            <div className="intro-eyebrow fade-up">AI-Powered Skin Analysis</div>
            <h1 className="fade-up fade-up-1">Know your skin.<br /><em>Transform</em> your care.</h1>
            <p className="intro-sub fade-up fade-up-2">
              Clinical-grade AI assessment with personalized treatment plans,
              product recommendations, and a professional PDF report.
            </p>

            <div className="feat-strip fade-up fade-up-3">
              <div className="feat-item"><span className="feat-num">3</span><span className="feat-label">Angle Scan</span></div>
              <div className="feat-item"><span className="feat-num">7</span><span className="feat-label">Face Zones</span></div>
              <div className="feat-item"><span className="feat-num">AI</span><span className="feat-label">Detection</span></div>
              <div className="feat-item"><span className="feat-num">PDF</span><span className="feat-label">Report</span></div>
            </div>

            <button className="btn-start fade-up fade-up-4" onClick={() => setStep('register')}>
              Begin Analysis
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* ═══ REGISTER ═══ */}
      {step === 'register' && (
        <div className="screen register">
          <div className="register-card">
            <button className="register-back" onClick={() => setStep('intro')}>
              ← Back
            </button>
            <h2>Your Details</h2>
            <p className="register-sub">We'll use your phone number to send your analysis report.</p>

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="tel" placeholder="+91 98765 43210" value={userInfo.phone}
                  onChange={e => setUserInfo(p => ({ ...p, phone: e.target.value }))} autoFocus />
              </div>
              {regError && <p className="form-error">{regError}</p>}
              <button type="submit" className="btn-register" disabled={regLoading}>
                {regLoading ? 'Saving...' : 'Continue to Camera →'}
              </button>
            </form>
            <p className="register-note">Your data is stored securely and used only for generating your personal report.</p>
          </div>
        </div>
      )}

      {/* ═══ CAPTURE ═══ */}
      {step === 'capture' && (
        <div className="capture">
          <div className="capture-layout">
            <div className="cam-wrap">
              <video ref={vidRef} autoPlay playsInline muted className="cam-video" />
              <canvas ref={canRef} style={{ display: 'none' }} />
              {!camReady && <div className="cam-loading"><div className="spin" /><p>Initializing camera...</p></div>}
              {camReady && <FaceGuide hasFace={hasFace} facePos={facePos} targetAngle={curAngle} faceBox={faceBox} canCapture={canCap} />}
              {quality?.quality?.resolution && (
                <div className="q-tags">
                  <span className={`q-tag ${quality.quality.lighting.isGood ? 'g' : 'w'}`}>{quality.quality.lighting.isGood ? '☀' : '◐'} Light</span>
                  <span className={`q-tag ${quality.quality.sharpness.isGood ? 'g' : 'w'}`}>{quality.quality.sharpness.isGood ? '◉' : '~'} Focus</span>
                </div>
              )}
            </div>
            <div className="cap-side">
              <button className={`btn-shutter ${canCap ? 'go' : ''}`} onClick={capture} disabled={!canCap}>
                <span className="shutter-ring"><span className="shutter-dot" /></span>
                <span>{shutterLabel}</span>
              </button>
              {hasFace && !isAngleOk() && !overrideReady && <p className="override-hint">Hold still... capture enables shortly</p>}
              {overrideReady && !isAngleOk() && <p className="override-hint ready">Capture enabled!</p>}
              <div className="thumbs">
                {angles.map(a => (
                  <div key={a.id} className={`thumb ${images[a.id] ? 'taken' : ''} ${curAngle === a.id && !images[a.id] ? 'active' : ''}`}>
                    {images[a.id] ? (
                      <><img src={images[a.id]} alt={a.label} /><button className="thumb-x" onClick={() => retake(a.id)}>↻</button><span className="thumb-ok">✓</span></>
                    ) : <span className="thumb-lbl">{a.label}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ANALYZING ═══ */}
      {step === 'analyzing' && (
        <div className="screen analyzing">
          <div className="analyzing-card">
            {images.front && <div className="scan-avatar"><img src={images.front} alt="face" /><div className="scan-bar" /></div>}
            <h2>Analyzing Your Skin</h2>
            <p className="analyzing-sub">AI assessment in progress</p>
            <div className="analyze-steps">
              {['Verifying image quality', 'Detecting conditions', 'Analyzing facial zones', 'Building treatment plan'].map((l, i) => (
                <div key={i} className={`a-step ${aStep >= i ? 'on' : ''} ${aStep > i ? 'done' : ''}`}>
                  <span className="a-dot">{aStep > i ? '✓' : aStep === i ? '●' : '○'}</span>{l}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ RESULTS — SINGLE SCROLL ═══ */}
      {step === 'results' && analysis && (
        <div className="screen results">
          {/* Report Header + Score */}
          <div className="report-header fade-up">
            <div className="report-top">
              <div className="report-title">
                <h1>Skin Analysis Report</h1>
                <span className="report-date">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="report-actions">
                <button className="btn-pdf" onClick={downloadPdf} disabled={pdfLoading}>{pdfLoading ? 'Generating...' : 'Download PDF'}</button>
                <button className="btn-outline" onClick={() => share('whatsapp')}>WhatsApp</button>
                <button className="btn-outline" onClick={() => share('email')}>Email</button>
              </div>
            </div>
            <div className="score-hero">
              <div className="score-ring-wrap">
                <div className="score-ring">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="10" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke={scoreColor(analysis.overallScore)}
                      strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${(analysis.overallScore / 100) * 314} 314`}
                      transform="rotate(-90 60 60)"
                      style={{ transition: 'stroke-dasharray 1.5s ease' }} />
                  </svg>
                  <div className="score-val">
                    <span className="score-num">{analysis.overallScore}</span>
                    <span className="score-of">out of 100</span>
                  </div>
                </div>
              </div>
              <div className="score-info">
                <p>{analysis.summary}</p>
                <div className="score-badges">
                  <span className="score-badge" style={analysis.overallScore >= 70 ? { color: 'var(--green)', borderColor: 'rgba(45,138,78,0.3)', background: 'rgba(45,138,78,0.06)' } : analysis.overallScore >= 40 ? { color: 'var(--amber)', borderColor: 'rgba(193,127,36,0.3)', background: 'rgba(193,127,36,0.06)' } : { color: 'var(--red)', borderColor: 'rgba(196,64,64,0.3)', background: 'rgba(196,64,64,0.06)' }}>
                    {analysis.overallScore >= 70 ? 'Good' : analysis.overallScore >= 40 ? 'Fair' : 'Needs Attention'}
                  </span>
                  <span className="score-badge">{(analysis.skinType || '').charAt(0).toUpperCase() + (analysis.skinType || '').slice(1)} Skin</span>
                </div>
              </div>
            </div>
          </div>

          {/* Photos */}
          {analysis._images && (
            <div className="photos-section fade-up fade-up-1">
              <h2 className="section-title">Captured Photos</h2>
              <div className="photo-row">
                {angles.map(a => analysis._images[a.id] && (
                  <figure key={a.id} className="photo-fig">
                    <img src={analysis._images[a.id]} alt={a.label} />
                    <figcaption>{a.label}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}

          {/* Detected Conditions */}
          <div className="section-card fade-up fade-up-2">
            <h2 className="section-title">Detected Conditions</h2>
            {analysis.detectedIssues?.length > 0 ? (
              <div className="issues">
                {analysis.detectedIssues.map((is, i) => (
                  <div key={i} className={`issue sev-${is.severity}`}>
                    <div className="issue-top"><h3>{is.issue}</h3><span className="sev">{is.severity}</span></div>
                    <p>{is.description}</p>
                    {is.affected_areas?.length > 0 && <small className="areas">Affected areas: {is.affected_areas.join(', ')}</small>}
                  </div>
                ))}
              </div>
            ) : <p className="empty-msg">No significant conditions detected</p>}
          </div>

          {/* Zones */}
          {analysis.zoneAnalysis && (
            <div className="section-card fade-up fade-up-3">
              <h2 className="section-title">Facial Zone Analysis</h2>
              <div className="zones-grid">
                {Object.entries(analysis.zoneAnalysis).map(([z, d]) => (
                  <div key={z} className={`zone c-${d.condition}`}>
                    <div className="zone-head">
                      <span className="zone-name">{z.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="zone-sc">{d.score}/10</span>
                    </div>
                    <span className="zone-cond">{d.condition}</span>
                    {d.detail && <p className="zone-detail">{d.detail}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {analysis.productRecommendations?.length > 0 && (
            <div className="section-card fade-up fade-up-4">
              <h2 className="section-title">Recommended Products</h2>
              <div className="products-grid">
                {analysis.productRecommendations.map((p, i) => {
                  const tc = productColors[p.type?.toLowerCase()] || productColors.treatment;
                  return (
                    <div key={i} className="product-card">
                      <div className="product-type" style={{ background: tc.bg, color: tc.fg }}>{p.type}</div>
                      <h4>{p.name}</h4>
                      {p.brand && <p className="product-brand">{p.brand}</p>}
                      <p className="product-key">{p.keyIngredient}</p>
                      <p className="product-why">{p.description}</p>
                      <div className="product-meta">
                        <span>{p.usage}</span>
                      </div>
                      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="product-link">Shop Now</a>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Treatments */}
          {analysis.treatmentRecommendations?.length > 0 && (
            <div className="section-card fade-up fade-up-5">
              <h2 className="section-title">Treatment Plan</h2>
              <div className="treatments">
                {analysis.treatmentRecommendations.map((t, i) => (
                  <div key={i} className="treat">
                    <h3>{t.treatment}</h3>
                    <p>{t.purpose}</p>
                    <div className="treat-meta">
                      <small>{t.frequency}</small>
                      {t.notes && <small className="treat-note">{t.notes}</small>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Routine */}
          {analysis.homeCareRoutine && (
            <div className="section-card fade-up fade-up-6">
              <h2 className="section-title">Daily Routine</h2>
              <div className="routine-grid">
                <div className="routine-col">
                  <h3>☀ Morning</h3>
                  <ol>{analysis.homeCareRoutine.morning?.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </div>
                <div className="routine-col">
                  <h3>☾ Evening</h3>
                  <ol>{analysis.homeCareRoutine.evening?.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </div>
              </div>
            </div>
          )}

          {/* Lifestyle */}
          {analysis.lifestyleSuggestions && (
            <div className="section-card fade-up fade-up-7">
              <h2 className="section-title">Lifestyle Recommendations</h2>
              <div className="lifestyle-grid">
                {Object.entries(analysis.lifestyleSuggestions).map(([c, items]) => (
                  <div key={c} className="lifestyle-cat">
                    <h3>{c}</h3>
                    <ul>{items?.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {analysis.progressTimeline && (
            <div className="section-card fade-up fade-up-8">
              <h2 className="section-title">Expected Progress</h2>
              <div className="timeline">
                {Object.entries(analysis.progressTimeline).map(([p, c]) => (
                  <div key={p} className="tl-item">
                    <div className="tl-dot" />
                    <div>
                      <strong>{p.replace(/week/i, 'Week ').replace(/month/i, 'Month ').replace(/([A-Z])/g, ' $1').trim()}</strong>
                      <p>{c}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="disclaimer fade-up">
            This AI-generated report is for informational purposes only and does not constitute medical advice.
            Please consult a board-certified dermatologist for professional diagnosis and treatment.
          </p>

          {/* Footer Actions */}
          <div className="report-footer fade-up">
            <button className="btn-start" onClick={reset}>New Analysis →</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {error && <div className="toast"><span>{error}</span><button onClick={() => setError(null)}>✕</button></div>}
    </div>
  );
}

export default App;