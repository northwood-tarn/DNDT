// app/pixi/monoFilter.js
export function createMonoFilter({ contrast=1.15, brightness=1.0, crushMid=0.9 }={}){
  const frag = `precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uC, uB, uCr;
void main(){
  vec4 c = texture2D(uSampler, vTextureCoord);
  float g = dot(c.rgb, vec3(0.299,0.587,0.114));
  g = (g - 0.5) * uC + 0.5;
  g = mix(g, step(0.5, g), uCr);
  g *= uB;
  gl_FragColor = vec4(vec3(g), c.a);
}`;
  return new PIXI.Filter(undefined, frag, { uC: contrast, uB: brightness, uCr: crushMid });
}
