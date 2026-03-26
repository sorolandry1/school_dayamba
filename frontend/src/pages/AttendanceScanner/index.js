import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../services/api';
import { FiCamera, FiCheck, FiX, FiClock, FiUser, FiStopCircle } from 'react-icons/fi';

function AttendanceScanner() {
  const [scanType, setScanType] = useState('IN');
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [todayRecords, setTodayRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameras, setCameras] = useState([]);
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);

  useEffect(() => {
    fetchToday();
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const fetchToday = async () => {
    try {
      const res = await api.get('/attendance/today/');
      setTodayRecords(res.data.results || res.data);
    } catch (e) { console.error(e); }
  };

  const handleScan = async (qrData) => {
    if (!qrData || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post('/attendance/scan/', {
        qr_code_data: qrData.trim(),
        scan_type: scanType,
      });
      setResult(res.data);
      fetchToday();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.warning || 'Élève non trouvé ou QR invalide.');
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setError('');
    setResult(null);
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setError('Aucune caméra détectée sur cet appareil.');
        return;
      }
      setCameras(devices);
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerInstanceRef.current = html5QrCode;

      const cameraId = devices[devices.length - 1].id; // prefer back camera
      await html5QrCode.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScan(decodedText);
          stopCamera();
        },
        () => {} // suppress frame errors
      );
      setCameraActive(true);
    } catch (err) {
      setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      console.error(err);
    }
  };

  const stopCamera = async () => {
    if (scannerInstanceRef.current) {
      try {
        await scannerInstanceRef.current.stop();
        scannerInstanceRef.current.clear();
      } catch (_) {}
      scannerInstanceRef.current = null;
    }
    setCameraActive(false);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    handleScan(manualCode);
    setManualCode('');
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Scanner de Présence</h2>
          <p>{dateStr} — {timeStr}</p>
        </div>
      </div>

      <div className="scan-container">
        {/* Entrée / Sortie */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          <button
            className={`btn ${scanType === 'IN' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setScanType('IN'); stopCamera(); }}
            style={{ minWidth: 160 }}
          >
            <FiCheck size={18} /> Entrée (Matin)
          </button>
          <button
            className={`btn ${scanType === 'OUT' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setScanType('OUT'); stopCamera(); }}
            style={{ minWidth: 160 }}
          >
            <FiX size={18} /> Sortie (Soir)
          </button>
        </div>

        {/* Scanner caméra */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3><FiCamera size={18} style={{ marginRight: 8 }} />Scanner QR par caméra</h3>
          </div>
          <div className="card-body">
            {/* Zone caméra html5-qrcode */}
            <div
              id="qr-reader"
              ref={scannerRef}
              style={{
                width: '100%', maxWidth: 400, margin: '0 auto',
                display: cameraActive ? 'block' : 'none',
                borderRadius: 12, overflow: 'hidden',
              }}
            />

            {!cameraActive ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#667085', fontSize: '0.88rem', marginBottom: 16 }}>
                  Appuyez sur le bouton ci-dessous pour activer la caméra et scanner le QR code de l'élève.
                </p>
                <button className="btn btn-primary" onClick={startCamera} style={{ minWidth: 200 }}>
                  <FiCamera size={16} /> Activer la caméra
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <p style={{ color: '#667085', fontSize: '0.85rem', marginBottom: 12 }}>
                  Pointez la caméra vers le QR code de l'élève…
                </p>
                <button className="btn btn-secondary" onClick={stopCamera}>
                  <FiStopCircle size={16} /> Arrêter la caméra
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Saisie manuelle */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Saisie manuelle</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 12 }}>
              <input
                className="form-control"
                placeholder="Saisir le code QR manuellement…"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={loading || !manualCode}>
                {loading ? 'Scan...' : scanType === 'IN' ? 'Entrée' : 'Sortie'}
              </button>
            </form>
          </div>
        </div>

        {/* Résultat */}
        {result && (
          <div className="scan-result">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
              }}>
                <FiUser size={24} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: 2 }}>{result.student?.name || 'Élève'}</h3>
                <p style={{ color: '#667085', fontSize: '0.85rem' }}>{result.student?.classe || ''}</p>
              </div>
            </div>
            <div style={{
              background: '#d1fae5', color: '#065f46',
              padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem'
            }}>
              {result.message}
            </div>
          </div>
        )}

        {error && (
          <div className="scan-result error">
            <div style={{
              background: '#fee2e2', color: '#991b1b',
              padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem'
            }}>
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Présences du jour */}
      <div className="card" style={{ marginTop: 32 }}>
        <div className="card-header">
          <h3><FiClock size={18} style={{ marginRight: 8 }} />Présences du jour ({todayRecords.length})</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Élève</th>
                <th>Classe</th>
                <th>Entrée</th>
                <th>Sortie</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {todayRecords.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 32, color: '#98a2b3' }}>Aucune présence enregistrée aujourd'hui</td></tr>
              ) : todayRecords.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.student_name}</strong></td>
                  <td>{r.classe_name || '-'}</td>
                  <td>{r.check_in ? r.check_in.slice(0, 5) : '-'}</td>
                  <td>{r.check_out ? r.check_out.slice(0, 5) : '-'}</td>
                  <td>
                    <span className={`badge ${r.status === 'PRESENT' ? 'badge-success' : r.status === 'LATE' ? 'badge-warning' : 'badge-danger'}`}>
                      {r.status === 'PRESENT' ? 'Présent' : r.status === 'LATE' ? 'Retard' : 'Absent'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AttendanceScanner;
