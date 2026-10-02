import {
  ContentRoute,
  contentMetadata,
  contentStaticParams,
  type SlugParams,
} from '@/components/content/content-route';

export const revalidate = 300;

export function generateStaticParams() {
  return contentStaticParams('rewards');
}

export function generateMetadata({ params }: { params: SlugParams }) {
  return contentMetadata('rewards', params);
}

export default function RewardPage({ params }: { params: SlugParams }) {
  return <ContentRoute family="rewards" params={params} />;
}
