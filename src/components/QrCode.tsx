import qrcode from 'qrcode-generator';
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

interface Props {
  value: string;
  size?: number;
  color?: string;
  background?: string;
}

/** QR code dessiné en SVG (un seul tracé : léger et net à toutes les tailles). */
export const QrCode = memo(function QrCode({ value, size = 200, color = '#16120F', background = '#FFFFFF' }: Props) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
      }
    }
    return { path: d, count: n + 4 };
  }, [value]);

  return (
    <View accessibilityLabel="QR code d’invitation" accessible>
      <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
        <Rect x={0} y={0} width={count} height={count} fill={background} />
        <Path d={path} fill={color} />
      </Svg>
    </View>
  );
});
