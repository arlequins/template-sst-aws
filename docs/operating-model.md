# 운영 모델과 인계 규약

이 문서는 이 저장소를 소비하는 AWS bootstrap 프로젝트와 실제 애플리케이션
프로젝트의 경계를 정리한다. 이 템플릿은 계정 공통 제어와 재사용 가능한
S3 구성만 제공하며, 특정 계정의 값이나 애플리케이션 배포를 대신하지 않는다.

## 소유 경계

### 이 템플릿이 제공하는 것

- 계정 또는 리전에 한 번만 적용하는 비용·보안 기본값
- 계정 수준 S3 Block Public Access 네 가지 설정
- private S3 버킷의 암호화, 버전 관리, 소유권 제어, TLS-only 정책
- 상태 버킷과 불변 이벤트 원장을 위한 선택적 S3-primary 구성
- GitHub Actions OIDC 역할을 구성할 수 있는 typed builder
- Release Please와 Semantic Versioning을 통한 재사용 가능한 릴리스

### 소비자 프로젝트가 소유하는 것

- AWS 계정, 리전, 알림 수신자, 예산, 조직 구조
- 애플리케이션 API·웹·배치·도메인·CloudFront·런타임 역할
- 애플리케이션 데이터의 키 규칙, 보존 기간, 삭제 보호
- 실제 Secrets Manager 값과 GitHub Environment 값
- 애플리케이션별 OIDC trust subject와 배포 정책

계정 bootstrap과 애플리케이션 SST를 한 스택에 섞지 않는다. 애플리케이션을
삭제하거나 이름을 바꿔도 예산, OIDC trust, 계정 수준 공개 차단이 흔들리지
않아야 한다.

## 보안·운영 규약

1. 사람의 AWS 접근은 IAM Identity Center/SSO를 우선하고 장기 액세스 키를
   만들지 않는다.
2. CI의 AWS 접근은 GitHub Actions OIDC의 단기 자격 증명만 사용한다.
   Production은 별도 GitHub Environment와 승인 규칙을 사용한다.
3. trust policy는 저장소와 production Environment를 정확히 제한한다.
   저장소 전체 와일드카드, 브랜치 전체 신뢰, `AdministratorAccess`는 사용하지
   않는다.
4. 런타임 비밀은 Secrets Manager 또는 보호된 Environment에만 둔다. 비밀값을
   Git, SST state, 로그, GitHub output, 브라우저, `NEXT_PUBLIC_*`에 넣지 않는다.
5. GitHub App private key와 설치 식별자는 OIDC로 생성할 수 없는 외부 발급
   재료다. GitHub App에서 발급한 원문을 보호된 secret 경계에만 주입하고,
   조립된 런타임 secret 전체를 GitHub secret에 중복 저장하지 않는다.
6. Production 애플리케이션은 `protect: true`, `retain` 계열 제거 정책,
   리소스별 삭제 보호를 함께 검토한다. SST `protect`는 `sst remove`를 막을
   뿐, 구성에서 리소스를 제거하는 변경까지 막지는 않는다.

## 배포·검토 순서

### 템플릿 저장소

CI는 TypeScript 검사, 테스트, SST provider 준비만 수행한다. 템플릿 CI에는
AWS 자격 증명, `sst diff`, `sst deploy`, `sst remove`, AWS CLI 실행을 넣지
않는다.

변경은 다음 순서를 따른다.

1. Conventional Commit으로 feature/fix 변경을 만든다.
2. Pull Request에서 CI와 정책 테스트를 통과시킨다.
3. `main` 병합 후 Release Please가 버전 PR을 만든다.
4. 버전 PR 병합 시 `vX.Y.Z` 태그와 GitHub Release를 만든다.

소비자는 `main`이 아니라 검토가 끝난 immutable tag를 고정한다.

```json
{
  "dependencies": {
    "aws-account-baseline-sst": "github:OWNER/REPOSITORY#vX.Y.Z"
  }
}
```

### 계정 bootstrap 소비자

계정별 bootstrap 저장소에서 실제 값과 정책을 조합한다. 최초 배포는 SSO
관리자 또는 별도 승인된 bootstrap 경로로 한 번 수행하고, 이후 routine 변경은
보호된 GitHub Actions OIDC workflow에서만 수행한다.

각 변경은 다음 단계로 남긴다.

1. 비배포 CI와 정적 정책 테스트
2. 보호된 production Environment에서 `sst diff`
3. diff 승인 및 동일 커밋 확인
4. 같은 OIDC workflow의 `sst deploy`
5. 배포 후 계정·태그·역할·알림을 읽기 전용 검증

실제 계정 값, 역할 ARN, Secret ARN은 이 템플릿에 커밋하지 않는다.

## 계정별로 결정해야 하는 항목

다음 값은 템플릿이 추측하지 않고 소비자가 결정한다.

- 기본 리전과 추가로 적용할 리전
- 월 예산, zero-spend/actual/forecast 알림 수신자
- Cost Anomaly Detection 모니터 범위와 임계값
- CloudTrail을 기존 조직 trail과 공유할지, 별도 보관할지
- IAM Identity Center와 조직/계정 분리 모델
- 감사·원장 데이터의 보존 기간과 Object Lock 모드
- 애플리케이션별 도메인, CloudFront, 데이터 저장소
- 각 GitHub 저장소의 production Environment와 정확한 OIDC subject

## 현재 상태와 다음 인계

- 이 저장소는 배포 가능한 계정이 아니라 재사용 가능한 모듈이다.
- 실제 계정 설정은 별도 소비자 저장소에서 수행한다.
- 소비자는 릴리스 tag를 고정하고 lockfile을 갱신한 뒤 diff를 검토한다.
- 애플리케이션의 API·웹·게임·도메인 리소스는 이 템플릿에 추가하지 않는다.
- 새 애플리케이션을 연결할 때는 먼저 소유 경계, OIDC subject, 리전, 보존
  정책을 문서화한 뒤 정책 범위를 최소 권한으로 추가한다.

관련 문서:

- [Infrastructure architecture](architecture.md)
- [AWS initial setup checklist](initial-setup.md)
- [AWS bootstrap design](aws-bootstrap.md)
- [Consuming the template](consuming-the-template.md)
- [S3-primary application contract](s3-primary-data.md)
