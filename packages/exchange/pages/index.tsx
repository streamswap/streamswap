import Link from 'next/link';
import styles from '../styles/Home.module.css';
import MainLayout from '../components/MainLayout';

/** Home */
export default () => (
  <MainLayout title="Home">
    <h1 className={styles.title}>Streamswap</h1>

    <p>
      Continuous exchange of{' '}
      <a href="https://superfluid.finance" target="_blank" rel="noopener">
        Superfliud
      </a>{' '}
      streams
    </p>

    <div className={styles.grid}>
      <Link href="/exchange">
        <a className={styles.card}>
          <h2>Exchange &rarr;</h2>
          <p>Start exchanging super tokens now!</p>
        </a>
      </Link>

      <a href="" className={styles.card}>
        <h2>Documentation &rarr;</h2>
        <p>Learn about the inner workings of Streamswap.</p>
      </a>
    </div>
  </MainLayout>
);
