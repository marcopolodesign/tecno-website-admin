import { XMarkIcon } from '@heroicons/react/24/outline'

/**
 * Reusable Sidecart Component with fixed header, scrollable content, and sticky footer
 * Slides in from the right side of the screen
 * 
 * @param {boolean} isOpen - Whether the sidecart is open
 * @param {function} onClose - Callback when sidecart closes
 * @param {string} title - Sidecart title
 * @param {string} subtitle - Optional subtitle/description
 * @param {React.ReactNode} children - Sidecart content (scrollable)
 * @param {React.ReactNode} footer - Footer content (sticky at bottom)
 * @param {React.ReactNode} headerContent - Optional content to show below title (like email badge)
 * @param {string} size - Sidecart width: 'sm' | 'md' | 'lg'
 * @param {number} zIndex - z-index for the sidecart (default: 50)
 */
export default function Sidecart({ 
  isOpen, 
  onClose, 
  title, 
  subtitle,
  headerContent,
  children, 
  footer,
  size = 'md',
  zIndex = 50
}) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 animate-fade-in"
        style={{ zIndex: zIndex - 1 }}
        onClick={onClose}
      />
      
      {/* Sidecart Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-full ${sizeClasses[size]} bg-bg-secondary border-l border-border-default flex flex-col animate-slide-in-right`}
        style={{ zIndex }}
      >
        {/* Header - Fixed */}
        <div className="p-5 border-b border-border-default shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
              {subtitle && (
                <p className="text-sm text-text-secondary mt-1">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-surface rounded transition-colors -mt-1 -mr-1"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          
          {/* Optional header content (like email badge) */}
          {headerContent && (
            <div className="mt-4">
              {headerContent}
            </div>
          )}
        </div>
        
        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
        
        {/* Footer - Sticky */}
        {footer && (
          <div className="p-5 border-t border-border-default bg-bg-secondary shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
