/** Egne ikoner, tegnet som enkle strekformer. Ingen ikonpakke å laste. */
import Svg, { Path, Circle, Rect } from 'react-native-svg';

interface IkonProps { farge: string; storrelse?: number }

export const HusIkon = ({ farge, storrelse = 24 }: IkonProps) => (
  <Svg width={storrelse} height={storrelse} viewBox="0 0 24 24">
    <Path d="M3 11.2 12 4l9 7.2V20a1 1 0 0 1-1 1h-5v-6H10v6H4a1 1 0 0 1-1-1z"
      stroke={farge} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
  </Svg>
);

export const DekkIkon = ({ farge, storrelse = 24 }: IkonProps) => (
  <Svg width={storrelse} height={storrelse} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={8.5} stroke={farge} strokeWidth={1.8} fill="none" />
    <Circle cx={12} cy={12} r={3.2} stroke={farge} strokeWidth={1.8} fill="none" />
    <Path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" stroke={farge} strokeWidth={1.6} />
  </Svg>
);

export const KalenderIkon = ({ farge, storrelse = 24 }: IkonProps) => (
  <Svg width={storrelse} height={storrelse} viewBox="0 0 24 24">
    <Rect x={3.5} y={5} width={17} height={15.5} rx={2.5} stroke={farge} strokeWidth={1.8} fill="none" />
    <Path d="M3.5 10h17M8 3.5v3M16 3.5v3" stroke={farge} strokeWidth={1.8} />
  </Svg>
);

export const PersonIkon = ({ farge, storrelse = 24 }: IkonProps) => (
  <Svg width={storrelse} height={storrelse} viewBox="0 0 24 24">
    <Circle cx={12} cy={8.5} r={3.8} stroke={farge} strokeWidth={1.8} fill="none" />
    <Path d="M4.5 20.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" stroke={farge} strokeWidth={1.8} fill="none" />
  </Svg>
);

export const RuteIkon = ({ farge, storrelse = 24 }: IkonProps) => (
  <Svg width={storrelse} height={storrelse} viewBox="0 0 24 24">
    <Circle cx={6} cy={6} r={2.5} stroke={farge} strokeWidth={1.8} fill="none" />
    <Circle cx={18} cy={18} r={2.5} stroke={farge} strokeWidth={1.8} fill="none" />
    <Path d="M6 8.5v4a4 4 0 0 0 4 4h5.5" stroke={farge} strokeWidth={1.8} fill="none" />
  </Svg>
);
