import { PolicyPage } from '@/components/content/policy-page';
import { ko } from '@/lib/i18n';
import { pageMetadata } from '@/server/seo';

export const metadata = pageMetadata({
  title: '이용약관',
  description:
    'GAMEPULSE 정보의 성격, 공식 출처 우선 원칙, 지식재산권과 이용 시 유의사항을 안내합니다.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <PolicyPage
      title="이용약관"
      path="/terms"
      updatedAt="2026-10-02"
      intro={
        <p>
          GAMEPULSE는 여러 게임의 공식 공지에서 확인한 사실(패치, 이벤트, 보상, 초기화 일정)을
          한곳에 정리해 보여 주는 무료 서비스입니다.
        </p>
      }
      sections={[
        {
          title: '정보의 성격',
          body: (
            <>
              <p>
                모든 항목은 공식 출처로 연결되며, 공식 공지가 언제나 우선합니다. GAMEPULSE의 정보는
                참고용으로, 공지 변경이나 수집 지연으로 실제와 다를 수 있습니다. 중요한 결정을
                내리기 전에는 원문을 확인해 주세요.
              </p>
              <p>
                시간은 한국 시간으로 표시하며, 원문에 적힌 시간과 시간대를 함께 보여 줍니다. 날짜만
                공지된 경우 시각을 표시하지 않습니다.
              </p>
            </>
          ),
        },
        {
          title: '쿠폰 코드',
          body: (
            <p>
              쿠폰 코드는 공식 출처에서 확인된 경우에만 게시합니다. 사용 가능 여부와 보상 지급은 각
              게임사의 정책을 따릅니다.
            </p>
          ),
        },
        {
          title: '지식재산권',
          body: (
            <>
              <p>{ko.footer.disclaimer}</p>
              <p lang="en">{ko.footer.riot}</p>
              <p>
                GAMEPULSE는 공식 공지 전문을 복제하지 않으며, 구조화한 사실과 짧은 요약만
                제공합니다.
              </p>
            </>
          ),
        },
        {
          title: '이용 시 유의사항',
          body: (
            <p>
              서비스의 정상적인 운영을 방해하는 행위, 자동화된 수단으로 서비스 콘텐츠를 대량
              수집하는 행위, 서비스를 게임사 공식 서비스로 오인하게 하는 행위를 금지합니다.
            </p>
          ),
        },
        {
          title: '변경',
          body: <p>약관을 변경하면 이 페이지에 최종 업데이트 날짜와 함께 게시합니다.</p>,
        },
      ]}
    />
  );
}
