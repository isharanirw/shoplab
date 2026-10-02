import { isOn } from './flags';

/** f03 */
export const f03 = (min: number): number => (isOn('f03') ? 7 : min);

/** f06 */
export const f06 = (key: string): boolean => !(isOn('f06') && key === 'Escape');

/** f12 */
export const f12 = <T,>(value: T): T | undefined => (isOn('f12') ? undefined : value);

/** f14 */
export const f14 = (pattern: RegExp): RegExp => (isOn('f14') ? /^[^\s@]+@[^\s@]+$/ : pattern);

/** f16 */
export const f16 = (page: number, current: number): number => (isOn('f16') ? current : page);

/** f19 */
export const f19 = (min: number): number => (isOn('f19') ? 6 : min);

/** f22 */
export const f22 = (weekend: boolean): boolean => (isOn('f22') ? false : weekend);

/** f25 */
export const f25 = (min: number): number => (isOn('f25') ? min - 1 : min);
