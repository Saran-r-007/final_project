import { useState, useEffect } from 'react';
import {
  Heart,
  Shield,
  Flame,
  Phone,
  Mail,
  AlertTriangle,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Siren,
  Zap,
  Activity,
  Send,
} from 'lucide-react';
import { triggerEmergencyAlert, getEmergencyHistory, getNotificationConfig } from '../services/api';
import './EmergencyPanel.css';

const DEFAULT_RECEIVER_PHONE = '+91 95973 89141';
const DEFAULT_RECEIVER_EMAIL = 'saran2007r@gmail.com';

const SERVICE_CONTACTS = {
  medical: { label: 'Medical / Ambulance', phone: '+91 99430 81908', telLink: 'tel:+919943081908', icon: Heart, color: '#dc2626', glowColor: 'rgba(220,38,38,0.4)' },
  police: { label: 'Police', phone: '+91 79044 99489', telLink: 'tel:+917904499489', icon: Shield, color: '#2563eb', glowColor: 'rgba(37,99,235,0.4)' },
  fire: { label: 'Fire / Rescue', phone: '+91 90252 57115', telLink: 'tel:+919025257115', icon: Flame, color: '#ea580c', glowColor: 'rgba(234,88,12,0.4)' },
};

const ALERT_TYPES = [
  {
    key: 'medical',
    title: 'Medical / Ambulance',
    description: 'Dispatch emergency medical assistance or ambulance to your location immediately.',
  },
  {
    key: 'police',
    title: 'Police',
    description: 'Request police intervention or report a crime in progress.',
  },
  {
    key: 'fire',
    title: 'Fire / Rescue',
    description: 'Alert fire department for fire emergencies or rescue operations.',
  },
];

function EmergencyPanel({ onBack, user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [notification, setNotification] = useState(null);
  const [receiverPhone, setReceiverPhone] = useState(DEFAULT_RECEIVER_PHONE);
  const [receiverEmail, setReceiverEmail] = useState(DEFAULT_RECEIVER_EMAIL);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getEmergencyHistory();
      setHistory(data.events || data);
    } catch (err) {
      console.error('Failed to fetch emergency history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    getNotificationConfig().then((cfg) => {
      if (cfg.notification_phone) setReceiverPhone(cfg.notification_phone);
      if (cfg.notification_email) setReceiverEmail(cfg.notification_email);
    }).catch(() => {});
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleTriggerClick = (alertType) => {
    setConfirmModal(alertType);
  };

  const handleConfirm = async () => {
    const alertType = confirmModal;
    if (!alertType) return;

    setConfirmModal(null);
    setDispatching(alertType.key);

    try {
      const res = await triggerEmergencyAlert(
        alertType.key,
        `Emergency ${alertType.title} alert dispatched by user.`,
        receiverPhone,
        receiverEmail
      );

      const sent = res.notification?.sent;
      if (sent) {
        showNotification(`${alertType.title} alert dispatched successfully! Real email/SMS sent.`, 'success');
      } else {
        showNotification(`${alertType.title} alert processed. Delivery: ${res.notification?.details || 'Check server logs'}`, 'warning');
      }
      fetchHistory();
    } catch (_err) {
      showNotification(`Failed to dispatch ${alertType.title} alert.`, 'error');
    } finally {
      setDispatching(null);
    }
  };

  const handleCancel = () => {
    setConfirmModal(null);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'Unknown';
    const d = typeof ts === 'number' && ts < 1e12 ? new Date(ts * 1000) : new Date(ts);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAlertTypeMeta = (key) => {
    return SERVICE_CONTACTS[key] || SERVICE_CONTACTS.medical;
  };

  return (
    <div className="emergency-panel">
      {notification && (
        <div className={`emergency-toast ${notification.type === 'error' ? 'toast-error' : notification.type === 'warning' ? 'toast-warning' : 'toast-success'}`}>
          {notification.type === 'error' ? (
            <AlertTriangle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <header className="emergency-header">
        <button className="btn-icon" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <div className="emergency-header-center">
          <Siren size={28} />
          <h1>Emergency Alerts</h1>
        </div>
        <span className="tag-badge tag-live">
          <Zap size={12} />
          LIVE DISPATCH
        </span>
      </header>

      <p className="emergency-subtitle">
        Dispatch emergency alerts to designated responders. Alerts include your contact details, emergency type, and service-specific contact numbers.
      </p>

      <div className="emergency-contact-info">
        <span className="contact-chip">
          <Phone size={14} /> Receiver: {receiverPhone}
        </span>
        <span className="contact-chip">
          <Mail size={14} /> Receiver: {receiverEmail}
        </span>
      </div>

      <div className="emergency-cards">
        {ALERT_TYPES.map((alert) => {
          const service = SERVICE_CONTACTS[alert.key];
          const Icon = service.icon;
          const isDispatching = dispatching === alert.key;
          return (
            <div
              key={alert.key}
              className="glass-panel emergency-card"
              style={{
                '--card-color': service.color,
                '--card-glow': service.glowColor,
              }}
            >
              <div className="card-icon-wrapper">
                <Icon size={48} />
              </div>
              <h2 className="card-title">{alert.title}</h2>
              <p className="card-description">{alert.description}</p>
              <div className="card-service-contact">
                <span className="service-contact-label">Service Contact:</span>
                <a href={service.telLink} className="service-contact-phone">
                  <Phone size={14} /> {service.phone}
                </a>
              </div>
              <div className="card-contact-row">
                <span className="contact-chip-sm">
                  <Phone size={12} /> To: {receiverPhone}
                </span>
                <span className="contact-chip-sm">
                  <Mail size={12} /> To: {receiverEmail}
                </span>
              </div>
              <button
                className="btn-danger btn-alert-trigger"
                disabled={isDispatching}
                onClick={() => handleTriggerClick(alert)}
              >
                {isDispatching ? (
                  <>
                    <span className="spinner" />
                    Dispatching...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    TRIGGER ALERT
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <section className="emergency-history">
        <h2 className="history-heading">
          <Clock size={20} />
          Recent Emergency Events
        </h2>

        {loading ? (
          <div className="history-loading">
            <span className="spinner" />
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <div className="history-empty glass-panel">
            <Activity size={32} />
            <p>No emergency events recorded yet.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.map((event, idx) => {
              const eventKey = event.type || event.alert_type || 'medical';
              const meta = getAlertTypeMeta(eventKey);
              const Icon = meta.icon;
              return (
                <div key={event.id || idx} className="glass-panel history-item">
                  <div className="history-item-icon" style={{ color: meta.color }}>
                    <Icon size={22} />
                  </div>
                  <div className="history-item-details">
                    <span className="history-item-type">{meta.label}</span>
                    <span className="history-item-time">
                      <Clock size={12} />
                      {formatTimestamp(event.created_at || event.timestamp)}
                    </span>
                    {event.details && (
                      <span className="history-item-extra">{event.details}</span>
                    )}
                  </div>
                  <div className="history-item-actions">
                    <a
                      href={meta.telLink}
                      className="call-now-badge"
                      title={`Call ${meta.label}`}
                    >
                      <Phone size={12} /> Call Now: {meta.phone}
                    </a>
                    <span
                      className={`tag-badge ${
                        event.status === 'resolved'
                          ? 'tag-resolved'
                          : event.status === 'dispatched' || event.status === 'DISPATCHED'
                          ? 'tag-dispatched'
                          : 'tag-pending'
                      }`}
                    >
                      {(event.status || 'pending').toLowerCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {confirmModal && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="glass-panel modal-confirm" onClick={(e) => e.stopPropagation()}>
            <AlertTriangle size={48} className="modal-icon-warning" />
            <h3>Confirm Emergency Dispatch</h3>
            <p>
              Are you sure you want to dispatch a{' '}
              <strong style={{ color: SERVICE_CONTACTS[confirmModal.key]?.color }}>{confirmModal.title}</strong> alert?
            </p>
            <p className="modal-subtext">
              This will send an emergency notification to{' '}
              <strong>{receiverPhone}</strong> and <strong>{receiverEmail}</strong>.
            </p>
            <div className="modal-service-contact">
              <span>Service Contact: </span>
              <a href={SERVICE_CONTACTS[confirmModal.key]?.telLink} style={{ color: SERVICE_CONTACTS[confirmModal.key]?.color, fontWeight: 700 }}>
                {SERVICE_CONTACTS[confirmModal.key]?.phone}
              </a>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleConfirm}>
                <Siren size={16} />
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmergencyPanel;
