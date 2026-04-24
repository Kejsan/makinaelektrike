import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import {
  modalCloseButtonClass,
  modalContainerClass,
  modalHeaderClass,
  modalOverlayClass,
} from '../constants/modalStyles';

interface ModalLayoutProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClass?: string;
}

const focusableSelectors = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const ModalLayout: React.FC<ModalLayoutProps> = ({
  isOpen,
  onClose,
  title,
  description,
  headerContent,
  children,
  maxWidthClass = 'max-w-3xl',
}) => {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const getOrderedFocusables = (): HTMLElement[] => {
    if (!contentRef.current) {
      return [];
    }

    const focusableElements = Array.from(contentRef.current.querySelectorAll(focusableSelectors)).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );

    return focusableElements.filter(
      element => !element.hasAttribute('disabled') && element.getAttribute('tabindex') !== '-1',
    );
  };

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const [firstFocusable] = getOrderedFocusables();
    (closeButtonRef.current ?? firstFocusable ?? contentRef.current)?.focus?.();

    return () => {
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = getOrderedFocusables();
        if (focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement as HTMLElement | null;

        if (event.shiftKey) {
          if (activeElement === first || !contentRef.current?.contains(activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else if (activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={modalOverlayClass}
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        className={`${modalContainerClass} ${maxWidthClass} flex max-h-[calc(100dvh-2rem)] flex-col p-6 sm:max-h-[calc(100dvh-3rem)]`}
      >
        <div className={`${modalHeaderClass} shrink-0`}>
          {headerContent ?? (
            <div className="space-y-1">
              {title ? <h3 className="text-2xl font-semibold leading-tight">{title}</h3> : null}
              {description ? <p className="text-sm text-gray-300">{description}</p> : null}
            </div>
          )}
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className={modalCloseButtonClass}
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 min-h-0 space-y-4 overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ModalLayout;
