import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, placeholder, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuLayout, setMenuLayout] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        selectRef.current &&
        !selectRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setMenuLayout(null);
      return;
    }

    const updateMenuLayout = () => {
      if (!selectRef.current) {
        return;
      }

      const rect = selectRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const menuGap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const preferredSpace = openUp ? spaceAbove : spaceBelow;
      const fallbackSpace = openUp ? spaceBelow : spaceAbove;
      const availableSpace = Math.max(preferredSpace - menuGap, fallbackSpace - menuGap, 96);
      const maxHeight = Math.min(320, availableSpace);
      const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        window.innerWidth - viewportPadding - width,
      );

      setMenuLayout({
        left,
        width,
        top: openUp ? undefined : rect.bottom + menuGap,
        bottom: openUp ? window.innerHeight - rect.top + menuGap : undefined,
        maxHeight,
      });
    };

    updateMenuLayout();
    window.addEventListener('resize', updateMenuLayout);
    window.addEventListener('scroll', updateMenuLayout, true);

    return () => {
      window.removeEventListener('resize', updateMenuLayout);
      window.removeEventListener('scroll', updateMenuLayout, true);
    };
  }, [isOpen]);

  const selectedOption = options.find(option => option.value === value);

  return (
    <div className="relative z-30 w-full" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-full rounded-md border border-gray-600 bg-white/10 py-2.5 pl-10 pr-10 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-cyan focus:border-gray-cyan"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {icon && <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">{icon}</span>}
        <span className={`block truncate ${selectedOption ? 'text-white' : 'text-gray-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        typeof document !== 'undefined' &&
        menuLayout &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[2100] overflow-hidden rounded-md border border-gray-700 bg-gray-900/95 shadow-2xl backdrop-blur-sm focus:outline-none"
            style={{
              left: menuLayout.left,
              width: menuLayout.width,
              top: menuLayout.top,
              bottom: menuLayout.bottom,
            }}
          >
            <ul
              className="max-h-full overflow-auto py-1"
              role="listbox"
              style={{ maxHeight: menuLayout.maxHeight }}
            >
              {options.map(option => (
                <li
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className="relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-200 hover:bg-gray-cyan/20"
                  role="option"
                  aria-selected={value === option.value}
                >
                  <span className={`block truncate ${value === option.value ? 'font-semibold' : 'font-normal'}`}>
                    {option.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )
      )}
    </div>
  );
};

export default CustomSelect;
