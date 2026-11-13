"""Amplia fotos 4x com inteligência artificial (Real-ESRGAN x4plus, licença BSD-3), sem PyTorch.

Uso:
  pip install onnx onnxruntime numpy pillow
  curl -L -o RealESRGAN_x4plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
  python3 tools/ampliar_fotos.py RealESRGAN_x4plus.pth modelo.onnx foto.jpg foto-4x.jpg [outra.jpg outra-4x.jpg ...]

Lê os pesos com um leitor restrito (só números, nenhum código é executado), monta o modelo em ONNX
e processa a foto em blocos sobrepostos (sem emendas). O resultado mistura 80% da IA com 20% de uma
ampliação tradicional, para manter a textura natural de fotografia. Depois rode tools/hero_images.py."""
import sys, zipfile, pickle, collections, io
import numpy as np, onnx, onnxruntime as ort
from onnx import helper, TensorProto, numpy_helper

def load_pth(path):
    z = zipfile.ZipFile(path); names = z.namelist()
    root = names[0].split('/')[0]
    class Storage:
        def __init__(self, key, dtype): self.key, self.dtype = key, dtype
    class FloatStorage: pass
    def rebuild(storage, offset, size, stride, *a):
        raw = np.frombuffer(z.read(f'{root}/data/{storage.key}'), dtype=np.float32)
        n = int(np.prod(size)) if size else 1
        return np.lib.stride_tricks.as_strided(raw[offset:], shape=size, strides=[s * 4 for s in stride]).copy() if size else raw[offset:offset + 1].copy()
    class U(pickle.Unpickler):
        def find_class(self, mod, name):
            if (mod, name) == ('torch._utils', '_rebuild_tensor_v2'): return rebuild
            if (mod, name) == ('collections', 'OrderedDict'): return collections.OrderedDict
            if mod == 'torch' and name.endswith('Storage'): return FloatStorage
            raise pickle.UnpicklingError(f'bloqueado: {mod}.{name}')
        def persistent_load(self, pid):
            _, cls, key, loc, n = pid
            return Storage(key, cls)
    sd = U(io.BytesIO(z.read(f'{root}/data.pkl'))).load()
    return sd.get('params_ema', sd.get('params', sd))

def build(sd):
    nodes, inits = [], []
    c = [0]
    def name(p): c[0] += 1; return f'{p}{c[0]}'
    def conv(x, w):
        W, B = sd[w + '.weight'], sd[w + '.bias']
        wn, bn = name('W'), name('B')
        inits.extend([numpy_helper.from_array(W, wn), numpy_helper.from_array(B, bn)])
        o = name('c'); nodes.append(helper.make_node('Conv', [x, wn, bn], [o], pads=[1, 1, 1, 1])); return o
    def lrelu(x): o = name('l'); nodes.append(helper.make_node('LeakyRelu', [x], [o], alpha=0.2)); return o
    def cat(xs): o = name('k'); nodes.append(helper.make_node('Concat', xs, [o], axis=1)); return o
    def scaled_add(a, b, s):
        sn = name('s'); inits.append(numpy_helper.from_array(np.array(s, np.float32), sn))
        m = name('m'); nodes.append(helper.make_node('Mul', [a, sn], [m]))
        o = name('a'); nodes.append(helper.make_node('Add', [m, b], [o])); return o
    def up2(x):
        sc = name('sc'); inits.append(numpy_helper.from_array(np.array([1, 1, 2, 2], np.float32), sc))
        o = name('u'); nodes.append(helper.make_node('Resize', [x, '', sc], [o], mode='nearest')); return o
    feat = conv('x', 'conv_first'); body = feat
    for i in range(23):
        r = body
        for j in (1, 2, 3):
            p = f'body.{i}.rdb{j}'; x = r
            x1 = lrelu(conv(x, p + '.conv1')); x2 = lrelu(conv(cat([x, x1]), p + '.conv2'))
            x3 = lrelu(conv(cat([x, x1, x2]), p + '.conv3')); x4 = lrelu(conv(cat([x, x1, x2, x3]), p + '.conv4'))
            x5 = conv(cat([x, x1, x2, x3, x4]), p + '.conv5'); r = scaled_add(x5, x, 0.2)
        body = scaled_add(r, body, 0.2)
    b = conv(body, 'conv_body'); o = name('a'); nodes.append(helper.make_node('Add', [feat, b], [o]))
    f = lrelu(conv(up2(o), 'conv_up1')); f = lrelu(conv(up2(f), 'conv_up2'))
    out = conv(lrelu(conv(f, 'conv_hr')), 'conv_last')
    nodes.append(helper.make_node('Identity', [out], ['y']))
    g = helper.make_graph(nodes, 'rrdb', [helper.make_tensor_value_info('x', TensorProto.FLOAT, [1, 3, None, None])],
                          [helper.make_tensor_value_info('y', TensorProto.FLOAT, [1, 3, None, None])], inits)
    m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 13)]); m.ir_version = 8; return m

def upscale(sess, img, tile=192, pad=12):
    """img: float32 HxWx3 em 0..1 -> 4x, por blocos com sobreposição para não haver emendas."""
    H, W, _ = img.shape; out = np.zeros((H * 4, W * 4, 3), np.float32)
    for y in range(0, H, tile):
        for x in range(0, W, tile):
            y0, x0 = max(0, y - pad), max(0, x - pad); y1, x1 = min(H, y + tile + pad), min(W, x + tile + pad)
            t = img[y0:y1, x0:x1].transpose(2, 0, 1)[None]
            r = sess.run(None, {'x': t})[0][0].transpose(1, 2, 0)
            ty, tx = (y - y0) * 4, (x - x0) * 4; hh, ww = min(tile, H - y) * 4, min(tile, W - x) * 4
            out[y * 4:y * 4 + hh, x * 4:x * 4 + ww] = r[ty:ty + hh, tx:tx + ww]
        print(f'  linha {y + tile}/{H}', flush=True)
    return np.clip(out, 0, 1)

if __name__ == '__main__':
    from PIL import Image
    pth, onnx_path = sys.argv[1], sys.argv[2]
    import os
    if not os.path.exists(onnx_path):
        onnx.save(build(load_pth(pth)), onnx_path)
    so = ort.SessionOptions(); so.intra_op_num_threads = 4
    sess = ort.InferenceSession(onnx_path, so, providers=['CPUExecutionProvider'])
    for src, dst in zip(sys.argv[3::2], sys.argv[4::2]):
        im = np.asarray(Image.open(src).convert('RGB'), np.float32) / 255
        print(src, im.shape, flush=True)
        r = upscale(sess, im)
        base = np.asarray(Image.open(src).convert('RGB').resize((r.shape[1], r.shape[0]), Image.LANCZOS), np.float32) / 255
        r = np.clip(.8 * r + .2 * base, 0, 1)
        Image.fromarray((r * 255 + .5).astype(np.uint8)).save(dst, quality=97)
        print('->', dst, r.shape, flush=True)
