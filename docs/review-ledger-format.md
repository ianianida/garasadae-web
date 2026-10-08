# 전 구절 검수 원장과 출시 검사

본문 자료와 절별 원장은 공개 저장소에 보관한다. 실제 사용자 고민·피드백, API 키, 계정 비밀번호는 이 자료에 포함하지 않는다.

## 1. 개별 검수

`data/review/books/<CODE>.json`은 [개별 검수 기준](../data/review/criteria.md)의 형식으로 기록한다. 부분 저장을 허용하고, 저장하지 않은 절은 미검수로 남긴다. `npm run review:status`는 저장된 판정 중 현재 본문 해시·형식이 맞는 항목만 집계한다.

## 2. 후보·보류 재검토

직접 읽고 재검토한 뒤 `data/review/final-decisions.json`을 작성한다. 초기 후보와 보류에는 모두 최종 판단이 필요하다. 제외에서 다시 검토해 후보로 바꾸는 경우도 별도 판단을 남긴다.

```json
{
  "corpusSha256": "현재 manifest 값",
  "criteriaVersion": "garasadae-corpus-2026-10-08-v1",
  "reviewer": "Codex integration review",
  "method": "direct-codex-reading",
  "decisions": [
    {
      "id": "KRV:BOOK:1:1",
      "textSha256": "현재 절 본문 해시",
      "status": "candidate 또는 hold 또는 exclude",
      "reason": "전체 절을 다시 읽고 판단한 근거",
      "counterexampleNote": "제약이 다른 구체 고민에서 연결이 약해지는 조건",
      "connections": [
        {
          "scenarioId": "생성 고민 ID",
          "clue": "읽을 선택 실마리",
          "friction": "전체 절의 연결 마찰",
          "expectedEnough": "yes 또는 uncertain 또는 no"
        }
      ]
    }
  ]
}
```

## 3. 도입 확인

`data/review/release-manifest.json`은 최종 추첨에 실제로 들어간 목록이다. 본문 전체를 판본 출처에서 재확인하고 구체 고민에 대조한 규칙을 연결한 뒤 작성한다.

```json
{
  "corpusSha256": "현재 manifest 값",
  "criteriaVersion": "garasadae-corpus-2026-10-08-v1",
  "activeVerseIds": ["실제 운영에 도입한 절 ID"],
  "sourceChecks": [
    {
      "id": "도입한 절 ID",
      "textSha256": "본문 해시",
      "verifiedUrl": "서비스에 표시하는 판본 출처 URL",
      "checkedAt": "ISO 8601 시각",
      "method": "publisher-attributed-whole-verse-comparison"
    }
  ],
  "ruleChecks": [
    { "ruleId": "실제 규칙 ID", "caseIds": ["생성 고민 ID"], "reason": "규칙 조건과 사례 대조 근거" }
  ],
  "baseCaseIds": ["마지막 확장 후보를 검토한 생성 고민 ID"]
}
```

`npm run release:check`는 원장 전체 누락·중복·해시, 재검토 기록, 도입 본문 확인, 실제 서비스의 후보·규칙 일치를 확인한다. 검수하지 않은 원장이나 기록을 만들기만 해서 통과하는 것으로 의미 검수를 대체하지 않는다. 검사의 통과도 모든 사용자의 만족을 보장하는 수치는 아니다.

Vercel은 이 검사를 통과해야 빌드한다. 로컬 `npm run build`는 웹 코드 확인용이며 공개 출시 완료를 뜻하지 않는다.
