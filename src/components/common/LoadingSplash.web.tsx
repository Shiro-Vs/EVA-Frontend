import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

const LOGO_LIGHT_BG = require('../../../assets/LogoEVA_Fclaro.png');
const LOGO_DARK_BG = require('../../../assets/LogoEVA_Foscuro.png');

interface LoadingSplashProps {
  onAnimationComplete?: () => void;
  isReady?: boolean;
}

export default function LoadingSplash({ onAnimationComplete, isReady }: LoadingSplashProps) {
  const { colors, isDark } = useAppTheme();

  const themeColors = colors;
  const logoSource = isDark ? LOGO_DARK_BG : LOGO_LIGHT_BG;
  const textColor = isDark ? themeColors.text : themeColors.primary;

  const [mounted, setMounted] = useState(false);
  const [fadedOut, setFadedOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isReady && !fadedOut) {
      setFadedOut(true);
      const timer = setTimeout(() => {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [isReady, fadedOut, onAnimationComplete]);

  const containerStyle: any = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: themeColors.background,
    opacity: fadedOut ? 0 : 1,
    transition: 'opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: fadedOut ? 'none' : 'auto',
  };

  const contentStyle: any = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 300ms ease-out',
    opacity: mounted ? 1 : 0,
  };

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <Image
          source={logoSource}
          style={{ width: 220, height: 220, alignSelf: 'center' }}
          resizeMode="contain"
        />
        <p style={{
          fontSize: '72px',
          letterSpacing: '14px',
          fontFamily: 'AsapBoldItalic',
          color: textColor,
          margin: 0,
          marginTop: '24px',
        }}>
          EVA
        </p>
      </div>
    </div>
  );
}
