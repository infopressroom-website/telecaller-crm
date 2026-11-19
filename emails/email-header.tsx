import { Section, Heading } from '@react-email/components';
import React from 'react';

interface EmailHeaderProps {
  title: string;
  backgroundColor?: string;
}

export function EmailHeader({ 
  title, 
  backgroundColor = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
}: EmailHeaderProps) {
  return (
    <Section style={{ ...headerStyle, background: backgroundColor }}>
      <Heading style={headingStyle}>{title}</Heading>
    </Section>
  );
}

const headerStyle = {
  padding: '30px',
  textAlign: 'center' as const,
  borderRadius: '8px 8px 0 0',
};

const headingStyle = {
  color: 'white',
  margin: '0',
  fontSize: '24px',
};
