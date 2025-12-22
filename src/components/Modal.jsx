import { XMarkIcon } from '@heroicons/react/24/outline'

/**
 * Reusable Modal Component with fixed header, scrollable content, and sticky footer
 * 
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Callback when modal closes
 * @param {string} title - Modal title
 * @param {string} subtitle - Optional subtitle
 * @param {React.ReactNode} children - Modal content (scrollable)
 * @param {React.ReactNode} footer - Footer content (sticky at bottom)
 * @param {string} size - Modal size: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
 */
export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  subtitle,
  children, 
  footer,
  size = 'lg'
}) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl'
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`bg-bg-secondary rounded-lg shadow-xl ${sizeClasses[size]} w-full max-h-[90vh] flex flex-col animate-fade-in`}>
          {/* Header - Fixed */}
          <div className="p-4 border-b border-border-default shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
                {subtitle && (
                  <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-bg-surface rounded transition-colors -mt-1 -mr-1"
              >
                <XMarkIcon className="h-5 w-5 text-text-secondary" />
              </button>
            </div>
          </div>
          
          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
          
          {/* Footer - Sticky */}
          {footer && (
            <div className="p-4 border-t border-border-default bg-bg-secondary shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
