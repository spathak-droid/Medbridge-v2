import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleGoHome = (): void => {
    window.location.href = '/'
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={styles.overlay}>
          <div style={styles.card}>
            {/* CareArc logo */}
            <div style={styles.logoCircle}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill="white"
                />
              </svg>
            </div>

            <h1 style={styles.title}>Something went wrong</h1>

            {this.state.error && (
              <div style={styles.errorBox}>
                <p style={styles.errorText}>{this.state.error.message}</p>
              </div>
            )}

            <div style={styles.buttonRow}>
              <button style={styles.primaryButton} onClick={this.handleReload}>
                Reload page
              </button>
              <button style={styles.secondaryButton} onClick={this.handleGoHome}>
                Go home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f0f5ff',
    padding: '1rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '2.5rem 2rem',
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
  },
  logoCircle: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#005fae',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#1a1a1a',
    margin: '0 0 1rem 0',
  },
  errorBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    width: '100%',
    marginBottom: '1.5rem',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#666666',
    margin: 0,
    wordBreak: 'break-word',
  },
  buttonRow: {
    display: 'flex',
    gap: '0.75rem',
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    padding: '0.625rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: '#005fae',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  secondaryButton: {
    flex: 1,
    padding: '0.625rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#005fae',
    backgroundColor: '#ffffff',
    border: '1px solid #005fae',
    borderRadius: '8px',
    cursor: 'pointer',
  },
}

export default ErrorBoundary
