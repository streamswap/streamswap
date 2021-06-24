import styles from '../styles/MainLayout.module.css';
import Head from 'next/head';
import Footer from '../components/Footer';

const MainLayout = (args: { children: JSX.Element | JSX.Element[]; title?: string }) => (
  <div className={styles.container}>
    <Head>
      <title>Streamswap{args.title ? ` - ${args.title}` : ''}</title>
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <main className={styles.main}>{args.children}</main>
    {Footer()}
  </div>
);

export default MainLayout;
