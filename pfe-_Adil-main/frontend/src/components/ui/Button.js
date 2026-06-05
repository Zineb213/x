import React from 'react';
import './Button.css';

const Button = ({ 
    children, 
    variant = 'primary', 
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    onClick,
    type = 'button',
    fullWidth = false,
    className = ''
}) => {
    const getVariantClass = () => {
        switch(variant) {
            case 'primary': return 'btn-primary';
            case 'secondary': return 'btn-secondary';
            case 'danger': return 'btn-danger';
            case 'success': return 'btn-success';
            case 'outline': return 'btn-outline';
            default: return 'btn-primary';
        }
    };

    const getSizeClass = () => {
        switch(size) {
            case 'sm': return 'btn-sm';
            case 'lg': return 'btn-lg';
            default: return 'btn-md';
        }
    };

    return (
        <button
            type={type}
            className={`btn ${getVariantClass()} ${getSizeClass()} ${fullWidth ? 'btn-fullwidth' : ''} ${className}`}
            onClick={onClick}
            disabled={disabled || loading}
        >
            {loading && <span className="btn-spinner"></span>}
            {icon && <span className="btn-icon">{icon}</span>}
            {children}
        </button>
    );
};

export default Button;
