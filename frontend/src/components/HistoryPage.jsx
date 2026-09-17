import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Download,
  Trash2,
  Clock,
  Filter,
  AlertTriangle,
  Activity,
  FileAudio,
  Siren,
  ArrowLeft,
  Eye,
} from 'lucide-react';
import { getHistory, deleteHistoryItem, downloadCSECSV } from '../services/api';


const TYPE_ICONS = {
  AUDIO_UPLOAD: <FileAudio size={16} />,
  EMERGENCY_ALERT: <Siren size={16} />,
};

const TYPE_LABELS = {
  AUDIO_UPLOAD: 'Audio Upload',
  EMERGENCY_ALERT: 'Emergency Alert',
};

const SEVERITY_COLORS = {
  CRITICAL: {
    bg: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    border: 'rgba(239, 68, 68, 0.3)',
  },
  WARNING: {
    bg: 'rgba(245, 158, 11, 0.15)',
    color: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  INFO: {
    bg: 'rgba(59, 130, 246, 0.15)',
    color: '#3b82f6',
    border: 'rgba(59, 130, 246, 0.3)',
  },
  PEACEFUL: {
    bg: 'rgba(34, 197, 94, 0.15)',
    color: '#22c55e',
    border: 'rgba(34, 197, 94, 0.3)',
  },
};

function formatTimestamp(ts) {
  if (!ts) return '\u2014';
  return new Date(ts * 1000).toLocaleString();
}

function formatDuration(seconds) {
  if (seconds == null) return '\u2014';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function riskColor(score) {
  if (score == null) return 'var(--text-muted)';
  if (score >= 70) return '#ef4444';
  if (score >= 40) return '#f59e0b';
  return '#22c55e';
}

export default function HistoryPage({ onBack, onViewReport }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [deleteError, setDeleteError] = useState(null);
  const [downloadingCSV, setDownloadingCSV] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchHistory() {
      try {
        setLoading(true);
        setError(null);
        const data = await getHistory();
        const items = Array.isArray(data) ? data : (data?.history || []);
        const mapped = items.map((item) => ({
          ...item,
          timestamp: item.timestamp || item.created_at,
          incident: item.incident || item.detected_incident || "",
          notified: item.notified ?? (item.notification_status && item.notification_status !== "None" && item.notification_status !== ""),
        }));
        if (!cancelled) setHistory(mapped);
      } catch (err) {
        if (!cancelled)
          setError(err.message || 'Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return history.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (severityFilter !== 'all' && item.severity !== severityFilter)
        return false;
      if (q) {
        const haystack = [
          item.filename,
          item.incident,
          item.severity,
          item.transcript,
          item.analysis_id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [history, searchQuery, typeFilter, severityFilter]);

  const handleDelete = useCallback(async (id, filename) => {
    if (!window.confirm(`Delete record "${filename || id}"?`)) return;
    setDeleteError(null);
    try {
      await deleteHistoryItem(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete record');
      setTimeout(() => setDeleteError(null), 5000);
    }
  }, []);

  const handleDownloadCSE = useCallback(async () => {
    setDownloadingCSV(true);
    try {
      await downloadCSECSV();
    } catch (err) {
      setDeleteError(err.message || 'Failed to download CSV');
      setTimeout(() => setDeleteError(null), 5000);
    } finally {
      setDownloadingCSV(false);
    }
  }, []);

  return (
    <div className="history-page" style={styles.page}>
      <style>{historyPageStyles}</style>

      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button
            className="btn-secondary btn-icon"
            onClick={onBack}
            style={styles.backBtn}
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={styles.title}>History &amp; Reports</h1>
            <p style={styles.subtitle}>
              <Clock
                size={14}
                style={{ marginRight: 6, verticalAlign: 'middle' }}
              />
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            className="btn-primary"
            onClick={handleDownloadCSE}
            disabled={downloadingCSV}
            style={styles.exportBtn}
          >
            <Download size={16} />
            {downloadingCSV ? 'Generating...' : 'Download CSV'}
          </button>
        </div>
      </div>

      {deleteError && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 8,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fda4af',
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <AlertTriangle size={16} />
          {deleteError}
        </div>
      )}

      <div className="glass-panel" style={styles.filtersBar}>
        <div style={styles.searchWrapper}>
          <Search size={16} style={styles.searchIcon} />
          <input
            className="form-input"
            type="text"
            placeholder="Search by filename, incident, severity, transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <Filter size={14} style={{ marginRight: 6, opacity: 0.6 }} />
          <label className="form-label" style={styles.filterLabel}>
            Type
          </label>
          <select
            className="form-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Types</option>
            <option value="AUDIO_UPLOAD">Audio Upload</option>
            <option value="EMERGENCY_ALERT">Emergency Alert</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <AlertTriangle size={14} style={{ marginRight: 6, opacity: 0.6 }} />
          <label className="form-label" style={styles.filterLabel}>
            Severity
          </label>
          <select
            className="form-input"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
            <option value="PEACEFUL">Peaceful</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={styles.centerState}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading history...</p>
        </div>
      ) : error ? (
        <div className="glass-panel" style={styles.errorState}>
          <AlertTriangle size={32} color="#ef4444" />
          <p style={{ color: '#ef4444', margin: '12px 0 0' }}>{error}</p>
          <button
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={styles.emptyState}>
          <Activity size={40} color="var(--text-muted)" strokeWidth={1.2} />
          <p
            style={{
              color: 'var(--text-muted)',
              margin: '12px 0 0',
              fontSize: 15,
            }}
          >
            {history.length === 0
              ? 'No history records yet. Upload an audio file to get started.'
              : 'No records match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="glass-panel" style={styles.tableWrapper}>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {tableHeaders.map((header) => (
                    <th key={header} style={styles.th}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <HistoryRow
                    key={item.id || item.analysis_id}
                    item={item}
                    onDelete={handleDelete}
                    onViewReport={onViewReport}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const tableHeaders = [
  'Date/Time',
  'Filename',
  'Type',
  'Service',
  'Contact',
  'Risk Score',
  'Severity',
  'Email Status',
  'SMS Status',
  'Actions',
];

function HistoryRow({ item, onDelete, onViewReport }) {
  const sev = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.INFO;
  const serviceLabel = item.service_label || '\u2014';
  const serviceContact = item.service_contact || '\u2014';
  const emailStatus = item.email_status || '\u2014';
  const smsStatus = item.sms_status || '\u2014';

  const statusColor = (s) => {
    if (s === 'SENT') return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' };
    if (s === 'FAILED') return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
    return { bg: 'rgba(107, 114, 128, 0.15)', color: '#6b7280', border: 'rgba(107, 114, 128, 0.3)' };
  };

  return (
    <tr
      style={styles.tr}
      className={item.analysis_id ? 'clickable-row' : ''}
    >
      <td style={styles.td}>
        <span style={styles.timestampCell}>
          <Clock size={13} style={{ opacity: 0.5, marginRight: 6 }} />
          {formatTimestamp(item.timestamp)}
        </span>
      </td>
      <td style={styles.td}>
        <span style={styles.filenameCell} title={item.filename}>
          {TYPE_ICONS[item.type] || <FileAudio size={16} />}
          <span style={{ marginLeft: 8 }}>{item.filename || '\u2014'}</span>
        </span>
      </td>
      <td style={styles.td}>
        <span className="tag-badge" style={styles.typeBadge}>
          {TYPE_LABELS[item.type] || item.type || '\u2014'}
        </span>
      </td>
      <td style={styles.td}>
        <span style={{ fontSize: 12, color: '#cbd5e1' }}>{serviceLabel}</span>
      </td>
      <td style={styles.td}>
        {serviceContact !== '\u2014' ? (
          <a
            href={`tel:${serviceContact.replace(/\s/g, '')}`}
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: '#818cf8',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            {serviceContact}
          </a>
        ) : (
          <span style={{ fontSize: 12, color: '#64748b' }}>{serviceContact}</span>
        )}
      </td>
      <td style={styles.td}>
        <span
          style={{
            color: riskColor(item.risk_score),
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {item.risk_score != null ? item.risk_score.toFixed(2) : '\u2014'}
        </span>
      </td>
      <td style={styles.td}>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            background: sev.bg,
            color: sev.color,
            border: `1px solid ${sev.border}`,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {item.severity || '\u2014'}
        </span>
      </td>
      <td style={styles.td}>
        <span
          className="tag-badge"
          style={{
            background: statusColor(emailStatus).bg,
            color: statusColor(emailStatus).color,
            border: `1px solid ${statusColor(emailStatus).border}`,
            fontSize: 11,
          }}
        >
          {emailStatus}
        </span>
      </td>
      <td style={styles.td}>
        <span
          className="tag-badge"
          style={{
            background: statusColor(smsStatus).bg,
            color: statusColor(smsStatus).color,
            border: `1px solid ${statusColor(smsStatus).border}`,
            fontSize: 11,
          }}
        >
          {smsStatus}
        </span>
      </td>
      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
        <div style={styles.actionsCell}>
          {item.analysis_id && (
            <button
              className="btn-secondary btn-icon"
              style={styles.actionBtn}
              title="View Report"
              onClick={() => onViewReport && onViewReport(item.analysis_id)}
            >
              <Eye size={15} />
            </button>
          )}
          <button
            className="btn-danger btn-icon"
            style={styles.actionBtn}
            title="Delete"
            onClick={() => onDelete(item.id, item.filename)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

const historyPageStyles = `
  .history-page .clickable-row {
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .history-page .clickable-row:hover {
    background: rgba(99, 102, 241, 0.06) !important;
  }
  .history-page .form-input,
  .history-page select.form-input {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: inherit;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }
  .history-page .form-input:focus,
  .history-page select.form-input:focus {
    border-color: rgba(99, 102, 241, 0.5);
  }
  .history-page .form-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.6;
  }
  .history-page .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
  }
  .history-page .btn-primary:hover { opacity: 0.9; }
  .history-page .btn-primary:active { transform: scale(0.98); }
  .history-page .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .history-page .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    color: inherit;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }
  .history-page .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }
  .history-page .btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .history-page .btn-danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }
  .history-page .btn-icon {
    padding: 6px 8px;
  }
  .history-page .glass-panel {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }
  .history-page .tag-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: rgba(99, 102, 241, 0.12);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.2);
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const styles = {
  page: {
    padding: '24px',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    opacity: 0.55,
    display: 'flex',
    alignItems: 'center',
  },
  exportBtn: {
    flexShrink: 0,
  },
  filtersBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '14px 18px',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  searchWrapper: {
    position: 'relative',
    flex: '1 1 260px',
    minWidth: 200,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    opacity: 0.4,
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    paddingLeft: 36,
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  filterLabel: {
    whiteSpace: 'nowrap',
  },
  select: {
    minWidth: 140,
  },
  centerState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid rgba(99, 102, 241, 0.2)',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.6,
    fontSize: 14,
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 24px',
    textAlign: 'center',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '80px 24px',
    textAlign: 'center',
  },
  tableWrapper: {
    overflow: 'hidden',
  },
  tableScroll: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
    minWidth: 900,
  },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    opacity: 0.5,
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    transition: 'background 0.15s',
  },
  td: {
    padding: '11px 14px',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  },
  timestampCell: {
    display: 'inline-flex',
    alignItems: 'center',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  filenameCell: {
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  typeBadge: {
    whiteSpace: 'nowrap',
  },
  incidentCell: {
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actionsCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    flexShrink: 0,
  },
};