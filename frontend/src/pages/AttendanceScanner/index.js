import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { FiCamera, FiCheck, FiX, FiClock, FiUser } from 'react-icons/fi';

function AttendanceScanner() {
  const [scanType, setScanType] = useState('IN');
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [todayRecords, setTodayRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchToday();
  }, []);

  const fetchToday = async () => {
    try {
      const res = await api.get('/attendance/today/');
      setTodayRecords(res.data.results || res.data);
    } catch (e) { console.error(e); }
  };

  const handleScan = async (qrData) => {
    if (!qrData) return;
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
      setError(err.response?.data?.error || err.response?.data?.warning || 'Erreur lors du scan.');
    } finally {
      setLoading(false);
    }
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
        {/* Scan Type Selector */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          <button
            className={`btn ${scanType === 'IN' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setScanType('IN')}
            style={{ minWidth: 160 }}
          >
            <FiCheck size={18} /> Entrée (Matin)
          </button>
          <button
            className={`btn ${scanType === 'OUT' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setScanType('OUT')}
            style={{ minWidth: 160 }}
          >
            <FiX size={18} /> Sortie (Soir)
          </button>
        </div>

        {/* Manual QR Input */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3><FiCamera size={18} style={{ marginRight: 8 }} />Scanner le QR Code</h3>
          </div>
          <div className="card-body">
            <p style={{ color: '#667085', fontSize: '0.88rem', marginBottom: 16 }}>
              Scannez le QR code de l'élève ou saisissez le code manuellement
            </p>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 12 }}>
              <input
                className="form-control"
                placeholder="Code QR (ex: STU-XXXXXXXXXXXX)"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                autoFocus
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={loading || !manualCode}>
                {loading ? 'Scan...' : scanType === 'IN' ? 'Entrée' : 'Sortie'}
              </button>
            </form>
          </div>
        </div>

        {/* Result */}
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

      {/* Today's Records */}
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
                  <td>{r.check_in || '-'}</td>
                  <td>{r.check_out || '-'}</td>
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
