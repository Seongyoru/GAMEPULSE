import { PolicyPage } from '@/components/content/policy-page';
import { PREFERENCES_STORAGE_KEY } from '@/lib/my-games-boot';
import { serverEnv } from '@/server/env';
import { pageMetadata } from '@/server/seo';

export const metadata = pageMetadata({
  title: '개인정보 처리방침',
  description:
    'GAMEPULSE는 회원가입 없이 이용하며 개인정보를 수집하지 않습니다. 내 게임 설정은 이 기기에만 저장됩니다.',
  path: '/privacy',
});

export default function PrivacyPage() {
  const contact = serverEnv().COLLECTOR_CONTACT;
  return (
    <PolicyPage
      title="개인정보 처리방침"
      path="/privacy"
      updatedAt="2026-10-02"
      intro={
        <p>
          GAMEPULSE는 계정 없이 이용하는 서비스입니다. 이름, 이메일, 게임 계정 정보 등 개인정보를
          요구하거나 수집하지 않습니다.
        </p>
      }
      sections={[
        {
          title: '이 기기에 저장되는 정보',
          body: (
            <p>
              &lsquo;내 게임&rsquo; 선택과 숨긴 항목은 브라우저의 로컬 저장소(
              <code>{PREFERENCES_STORAGE_KEY}</code>)에만 저장되며 서버로 전송되지 않습니다.
              브라우저의 사이트 데이터 삭제로 언제든 지울 수 있습니다.
            </p>
          ),
        },
        {
          title: '서버 접속 기록',
          body: (
            <p>
              서비스를 제공하는 서버와 CDN은 보안과 장애 대응을 위해 접속 기록(IP 주소, 요청 경로,
              시각, 브라우저 정보)을 처리할 수 있습니다. 이 기록은 해당 목적에만 사용하며 필요한
              최소 기간만 보관합니다.
            </p>
          ),
        },
        {
          title: '이용 통계',
          body: (
            <p>
              이용 통계 도구는 기본적으로 사용하지 않습니다. 사용하는 경우(예: Google Analytics 4)
              게임 선택, 페이지 열람 같은 제품 이벤트만 전송하며 개인을 식별할 수 있는 정보는 보내지
              않습니다. 이 경우 해당 도구가 쿠키를 사용할 수 있으며, 사용 여부는 이 문서에
              명시합니다.
            </p>
          ),
        },
        {
          title: '광고',
          body: (
            <p>
              현재 GAMEPULSE에는 광고가 게재되지 않습니다. 광고를 도입하면 이 문서를 먼저
              개정합니다.
            </p>
          ),
        },
        {
          title: '제3자 제공',
          body: <p>개인정보를 수집하지 않으므로 제3자에게 제공하는 개인정보가 없습니다.</p>,
        },
        {
          title: '문의',
          body: contact ? (
            <p>
              개인정보 관련 문의: <span className="font-mono">{contact}</span>
            </p>
          ) : (
            <p>개인정보 관련 문의처는 서비스 정식 공개 시 이 페이지에 게시합니다.</p>
          ),
        },
      ]}
    />
  );
}
