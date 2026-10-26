import React, { useEffect } from 'react'
import { AlertTriangle, Info, Trash2, X } from 'lucide-react'
import './ConfirmModal.css'

export interface ConfirmModalProps {
  isOpen: boolean
  title: string
  description: string
  confirmText?: string | undefined
  cancelText?: string | undefined
  variant?: 'danger' | 'warning' | 'info' | undefined
  isLoading?: boolean | undefined
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onCancel()
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isLoading, onCancel])

  if (!isOpen) return null

  const renderIcon = () => {
    switch (variant) {
      case 'danger':
        return <Trash2 className="confirm-icon danger" size={24} />
      case 'warning':
        return <AlertTriangle className="confirm-icon warning" size={24} />
      case 'info':
      default:
        return <Info className="confirm-icon info" size={24} />
    }
  }

  return (
    <div className="confirm-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="confirm-modal-backdrop" onClick={() => !isLoading && onCancel()} />
      <div className={`confirm-modal-card ${variant}`}>
        <button
          className="confirm-modal-close"
          onClick={onCancel}
          disabled={isLoading}
          aria-label="Fechar confirmação"
        >
          <X size={18} />
        </button>

        <div className="confirm-modal-header">
          <div className={`confirm-icon-box ${variant}`}>{renderIcon()}</div>
          <div className="confirm-header-text">
            <h3 id="confirm-modal-title">{title}</h3>
            <p>{description}</p>
          </div>
        </div>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="btn-confirm-cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn-confirm-action ${variant}`}
            onClick={() => void onConfirm()}
            disabled={isLoading}
          >
            {isLoading ? 'Processando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
