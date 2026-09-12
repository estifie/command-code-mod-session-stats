import type {ModApi} from '@commandcode/harness';
import {createMod} from './src/mod.ts';

export default createMod() as (cmd: ModApi) => void;
