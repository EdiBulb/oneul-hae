import * as THREE from 'three';

/**
 * 한 번 그리고 다시 안 바뀌는 캔버스 텍스처를 픽셀 데이터(ImageData)로 바꿔 둔다.
 * 일부 아이폰(특히 인스타·쓰레드 안 브라우저처럼 메모리가 빠듯할 때)에서 2D 캔버스의 GPU 메모리가 비워지면
 * 그 캔버스로 만든 텍스처가 무지개색 잡티로 보이는 경우가 있어, 캔버스 대신 CPU 메모리의 픽셀을 올린다.
 */
export function stable<T extends THREE.Texture>(t: T): T {
  const c = t.image as HTMLCanvasElement | undefined;
  if (!c || !(c instanceof HTMLCanvasElement)) return t;
  try {
    const g = c.getContext('2d');
    if (!g) return t;
    t.image = g.getImageData(0, 0, c.width, c.height);
    t.needsUpdate = true;
  } catch { /* 실패하면 원래 캔버스 그대로 */ }
  return t;
}
