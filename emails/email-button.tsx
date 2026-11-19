import { Button } from '@react-email/components';
import React from 'react';

interface EmailButtonProps {
  href: string;
  text: string;
  backgroundColor?: string;
}

export function EmailButton({ 
  href, 
  text, 
  backgroundColor = '#667eea' 
}: EmailButtonProps) {
  return (
    <div style={containerStyle}>
      <Button href={href} style={{ ...buttonStyle, backgroundColor }}>
        {text}
      </Button>
    </div>
  );
}

const containerStyle = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const buttonStyle = {
  display: 'inline-block',
  color: 'white',
  textDecoration: 'none',
  padding: '12px 30px',
  borderRadius: '6px',
  fontWeight: '600',
};
