import styles from '../styles/Exchange.module.css';
import MainLayout from '../components/MainLayout';


export default () => (
  <MainLayout title="Exchange">
    <h2>Exchange</h2>
    <div className={styles.exchange}>
      <h3>From</h3>

      <h3>To</h3>
    </div>
  </MainLayout>
);
