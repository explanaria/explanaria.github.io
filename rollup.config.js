import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
export default [{
  input: 'src/main.js',
  output: {
    file: 'build/explanaria-bundle.js',
    format: 'umd',
	format_i_wish_i_could_use: 'es',
    name: 'EXP',
  },
  plugins: [resolve(),  commonjs()]
},
{
  input: 'src/main.js',
  output: {
    file: 'docs/resources/build/explanaria-bundle.js',
    format: 'umd',
	format_i_wish_i_could_use: 'es',
    name: 'EXP',
  },
  plugins: [resolve(),  commonjs()]
},


];
