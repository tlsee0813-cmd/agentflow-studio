// Public synthetic customer inputs. Only turns[].text goes into the product UI.
// Observations are for the human reviewer, NEVER appended to a model request.
export const cases=[
 {id:'01-four-turns',turns:['가입한 고객만 예약 취소','가입시키는 건 번거롭네. 문자로 보낸 링크만 있으면 취소하게 하자. 환불은 이번에 빼고','취소 버튼만 빨갛게','오타도 고쳐줘'],observe:{keep:['문자 링크로 취소','환불 제외'],retire:['가입 필수'],unknown:['실제 코드·완료 상태'],scope:'마지막 요청은 오타 수정; 목적 전체 재구현 아님'}},
 {id:'02-implicit',turns:['파일은 서버에 올려서 변환하고 결과를 내려받게 해줘.','고객 문서가 밖으로 나가는 건 곤란하겠어. 브라우저 안에서 끝내자. 화면 구성은 그대로.'],observe:{keep:['화면 구성'],retire:['서버 업로드'],unknown:['브라우저 변환 가능성은 로컬 조사'],scope:'자연어 수정의 목표와 기술 검증 구별'}},
 {id:'03-detail',turns:['배치 메모리를 줄여줘. 출력 순서와 값은 유지하고 운영 데이터는 건드리지 마.','진행 로그 문구만 조금 짧게 해줘.'],observe:{keep:['출력 순서·값','운영 데이터 미변경'],retire:[],unknown:['성능 개선 완료'],scope:'로그 문구만; 재측정·재구현을 자동 추가하지 않음'}},
 {id:'04-separate',turns:['문자 링크로 예약을 취소하게 해줘. 환불은 제외해.','별개로 통계 화면 차트 색을 회색으로 바꿔줘.'],observe:{keep:['차트 색 변경'],retire:[],unknown:[],scope:'예약 목적/환불 제외를 차트 작업의 전역 조건으로 강제하지 않음; 과거 원문은 보존'}},
 {id:'05-ambiguous',turns:['취소 링크는 24시간 뒤 만료되게 해줘.','링크 제한은 좀 풀어줘.'],observe:{keep:['아직 바꾸지 않은 조건'],retire:[],unknown:['만료 연장인지 횟수 제한 해제인지'],scope:'실제 결과를 바꾸는 한 가지 선택만 질문; 임의의 기간 결정 금지'}},
 {id:'06-return-manual',turns:['예약 링크로 취소하게 해줘. 환불은 이번에 빼고.','버튼 문구도 짧게 해줘.'],observe:{keep:['수동 정정: 취소 링크 12시간 만료','환불 제외'],retire:[],unknown:['합성 늦은 보고는 실행 증명 아님'],scope:'첫 작업 내보내기 후 직접 정정, 별개 요청, 첫 작업의 늦은 결과 파일, 다음 요청. 정확 parent와 수동 값 보존'}},
 {id:'07-idea',turns:['동네에서 남는 물건을 나눌 서비스를 생각 중인데, 우선 가능한 첫 접근안을 비교해줘. 저장소는 아직 없어.','연락처 공개는 부담스럽네. 공개 연락처 없이 연결되는 쪽으로 생각해줘.'],observe:{keep:['접근안 비교','공개 연락처 없음'],retire:['연락처 공개를 기정사실로 함'],unknown:['연결 수단/기술 가능성'],scope:'계획 요청을 구현 명령으로 바꾸지 않음'}}
];
