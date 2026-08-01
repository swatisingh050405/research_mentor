import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught React Error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center font-interface">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-purple-100 max-w-md w-full space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-black text-slate-900 font-display">
              Something went wrong
            </h2>
            <p className="text-xs text-slate-500">
              An unexpected error occurred while rendering this component.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-3 rounded-xl bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white text-xs font-bold shadow-md hover:opacity-90 transition-all cursor-pointer"
            >
              Return to Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
