import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiSend, FiUsers, FiCheck, FiAlertCircle, FiMessageSquare, FiMail } from 'react-icons/fi';

const TEMPLATES = [
  { label: 'Convocation réunion', text: 'Chers parents, nous vous convions à une réunion de parents d\'élèves le [DATE] à [HEURE]. Votre présence est fortement souhaitée. Direction.' },
  { label: 'Rappel paiement', text: 'Chers parents, nous vous rappelons que les frais de scolarité sont dus. Merci de régulariser votre situation auprès de l\'administration. Direction.' },
  { label: 'Fermeture exceptionnelle', text: 'Chers parents, nous vous informons que l\'établissement sera fermé le [DATE] pour [RAISON]. Les cours reprendront le [DATE]. Direction.' },
  { label: 'Résultats disponibles', text: 'Chers parents, les bulletins de notes sont disponibles. Vous pouvez les récupérer auprès de l\'administration. Direction.' },
];

function Communications() {
  const [classes, setClasses]             = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [channel, setChannel]             = useState('sms');   // 'sms' | 'email'
  const [subject, setSubject]             = useState('');
  const [message, setMessage]             = useState('');
  const [sending, setSending]             = useState(false);
  const [result, setResult]               = useState(null);
  const [studentCount, setStudentCount]   = useState(null);

  useEffect(() => {
    api.get('/classes/').then(r => setClasses(r.data.results || r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClasse) { setStudentCount(null); return; }
    api.get(`/students/?classe=${selectedClasse}&is_active=true`)
      .then(r => {
        const data = r.data.results || r.data;
        setStudentCount({
          total: data.length,
          withPhone: data.filter(s => s.parent_phone).length,
          withEmail: data.filter(s => s.parent_email).length,
        });
      }).catch(() => {});
  }, [selectedClasse]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (channel === 'email' && !subject.trim()) return;

    const targetCount = channel === 'sms'
      ? (studentCount?.withPhone || 'tous les')
      : (studentCount?.withEmail || 'tous les');

    if (!window.confirm(`Envoyer ce ${channel === 'sms' ? 'SMS' : 'email'} à ${targetCount} parent(s) ?`)) return;

    setSending(true);
    setResult(null);
    try {
      let res;
      if (channel === 'sms') {
        const payload = { message };
        if (selectedClasse) payload.classe_id = selectedClasse;
        res = await api.post('/payments/broadcast/send/', payload);
      } else {
        const payload = { subject, message };
        if (selectedClasse) payload.classe_id = selectedClasse;
        res = await api.post('/payments/broadcast/email/', payload);
      }
      setResult({ type: 'success', data: res.data, channel });
      setMessage('');
      if (channel === 'email') setSubject('');
    } catch (err) {
      setResult({ type: 'error', message: err.response?.data?.error || 'Erreur lors de l\'envoi.' });
    } finally {
      setSending(false);
    }
  };

  const charCount = message.length;
  const smsCount  = Math.ceil(charCount / 160) || 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Communications</h2>
          <p>Envoi de messages (SMS &amp; Email) aux parents d'élèves</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Main form */}
        <div>
          {/* Channel selector */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ padding: '12px 20px' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { key: 'sms',   label: 'SMS',   icon: <FiMessageSquare size={15} /> },
                  { key: 'email', label: 'Email',  icon: <FiMail size={15} /> },
                ].map(ch => (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() => { setChannel(ch.key); setResult(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.15s',
                      background: channel === ch.key ? 'var(--primary-600)' : 'var(--gray-100)',
                      color: channel === ch.key ? 'white' : 'var(--gray-600)',
                    }}
                  >
                    {ch.icon} {ch.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>
                {channel === 'sms'
                  ? <><FiMessageSquare size={16} style={{ marginRight: 8 }} />Nouveau SMS</>
                  : <><FiMail size={16} style={{ marginRight: 8 }} />Nouvel Email</>
                }
              </h3>
            </div>
            <form onSubmit={handleSend}>
              <div className="card-body">
                {/* Destinataires */}
                <div className="form-group">
                  <label>Destinataires</label>
                  <select className="form-control" value={selectedClasse}
                    onChange={e => setSelectedClasse(e.target.value)}>
                    <option value="">Tous les parents (toutes classes)</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {studentCount && (
                    <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#667085' }}>
                      <FiUsers size={12} style={{ marginRight: 4 }} />
                      {studentCount.total} élèves ·{' '}
                      {channel === 'sms'
                        ? <><strong>{studentCount.withPhone}</strong> numéros disponibles</>
                        : <><strong>{studentCount.withEmail}</strong> adresses email disponibles</>
                      }
                    </div>
                  )}
                </div>

                {/* Sujet (email only) */}
                {channel === 'email' && (
                  <div className="form-group">
                    <label>Sujet *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Objet de l'email..."
                    />
                  </div>
                )}

                {/* Message */}
                <div className="form-group">
                  <label>Message *</label>
                  <textarea
                    className="form-control"
                    rows={6}
                    required
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Rédigez votre message ici..."
                    style={{ resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.78rem', color: '#98a2b3' }}>
                    <span>{charCount} caractère(s)</span>
                    {channel === 'sms' && <span>{smsCount} SMS par destinataire</span>}
                  </div>
                </div>

                {/* Result */}
                {result && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 8, marginBottom: 8,
                    background: result.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: result.type === 'success' ? '#166534' : '#991b1b',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    {result.type === 'success' ? <FiCheck size={16} /> : <FiAlertCircle size={16} />}
                    {result.type === 'success'
                      ? `${result.data.sent} ${result.channel === 'sms' ? 'SMS' : 'email(s)'} envoyé(s)${result.data.failed > 0 ? `, ${result.data.failed} échec(s)` : ''}.`
                      : result.message
                    }
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #f2f4f7', padding: '16px 20px' }}>
                <button type="submit" className="btn btn-primary" disabled={sending || !message.trim() || (channel === 'email' && !subject.trim())}>
                  <FiSend size={15} />
                  {sending
                    ? 'Envoi en cours...'
                    : channel === 'sms' ? 'Envoyer le SMS' : 'Envoyer l\'Email'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3>Modèles de messages</h3>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {TEMPLATES.map((tpl, i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px 16px',
                    borderBottom: i < TEMPLATES.length - 1 ? '1px solid #f2f4f7' : 'none',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setMessage(tpl.text)}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>{tpl.label}</div>
                  <div style={{ fontSize: '0.78rem', color: '#98a2b3', lineHeight: 1.4 }}>
                    {tpl.text.slice(0, 80)}…
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header"><h3>Conseils</h3></div>
            <div className="card-body" style={{ fontSize: '0.82rem', color: '#667085', lineHeight: 1.6 }}>
              <p>• Remplacez <strong>[DATE]</strong> et <strong>[HEURE]</strong> par les valeurs réelles.</p>
              <p>• Un SMS = 160 caractères. Au-delà, il est découpé en plusieurs parties.</p>
              <p>• Vérifiez que les contacts parents sont saisis dans les fiches élèves.</p>
              <p>• SMS envoyés via Twilio · Emails via le serveur SMTP configuré.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Communications;
