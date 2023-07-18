import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
export default [{
  input: 'src/main.js',
  output: {
	sourcemap: true,
    file: 'build/explanaria-bundle.js',
	format: 'es',
    name: 'EXP',
  },
  plugins: [resolve(),  commonjs()]
},
{
  input: 'src/main.js',
  output: {
	sourcemap: true,
    file: 'docs/resources/build/explanaria-bundle.js',
	format: 'es',
    name: 'EXP',
  },
  plugins: [resolve(),  commonjs()]
},


];
