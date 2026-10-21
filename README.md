# StellaLux

## Release

`package.json`의 버전과 일치하는 `v` 태그를 푸시하면 GitHub Actions에서
Windows x64 설치 파일과 macOS Universal DMG/ZIP을 빌드합니다.
두 빌드가 모두 성공하면 업데이트 메타데이터와 blockmap을 포함해
같은 GitHub Release에 업로드하고 공개합니다.

```sh
git tag v3.2.9
git push origin v3.2.9
```

Actions의 **Build and release → Run workflow**에서 브랜치를 선택하면
릴리스를 공개하지 않고 빌드 결과만 확인할 수 있습니다.
Release 업로드에는 저장소의 기본 `GITHUB_TOKEN`을 사용합니다.
CI 빌드에는 코드 서명 인증서가 설정되어 있지 않습니다.

.env
```
CLIENT_ID
```

electron-builder.env
```
GH_TOKEN
```
