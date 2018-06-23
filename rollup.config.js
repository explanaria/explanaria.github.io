import resolve from 'rollup-plugin-node-resolve';
export default {
  input: 'src/main.js',
  output: {
    file: 'build/explanaria-bundle.js',
    format: 'umd',
	format_i_wish_i_could_use: 'es',
    name: 'EXP'
  },
  plugins: [ resolve() ]
};
