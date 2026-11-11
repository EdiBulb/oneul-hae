// 진행에 따라 열리는 장소. 처음엔 지금 맵 크기로 시작하고, 스킬과 퀘스트로 하나씩 열림.
// 지형을 바꾸지 않는 장소는 여기 조건만 바꾸면 보였다 숨었다 함 (진행이 바뀔 때마다 다시 확인).
import { SPOTS_PREVIEW } from './beach-extras';
import { hasSkill, questStep, questDone } from './progress';

export type RegionId = 'pond' | 'phoenixRock' | 'dangsan' | 'swing' | 'nightForest' | 'village' | 'milkyway';
/** 열림 조건 (true = 보임). 문서 '맵 확장' 표와 같은 순서 */
export const REGION_OPEN: Record<RegionId, () => boolean> = {
  pond: () => true,                                   // 청학지 · 천왕샘: 처음부터
  phoenixRock: () => true,                            // 봉황바위: 처음부터 멀리 보임 (못 감)
  dangsan: () => SPOTS_PREVIEW,                       // 당산나무: 할 일(다짐 리본)이 생기면 조건을 정함
  swing: () => SPOTS_PREVIEW,                         // 운해 그네: 할 일(앉아서 타기)이 생기면 조건을 정함
  nightForest: () => hasSkill('dokkaebi') || questStep('jara') >= 3, // 밤 숲: 도깨비불 보기를 배운 뒤
  village: () => questDone('tteok'),                  // 고갯길 너머 산아랫마을: 떡 호랑이를 풀면
  milkyway: () => hasSkill('fly'),                    // 은하수: 날기를 배운 뒤
};
export const regionOpen = (id: RegionId) => REGION_OPEN[id]();
