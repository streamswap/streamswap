import Link from 'next/link';
import styles from '../styles/Home.module.css';
import MainLayout from '../components/MainLayout';
import Card from '@material-ui/core/Card';
import Grid from '@material-ui/core/Grid';
import CardContent from '@material-ui/core/CardContent';

/** Home */
export default () => (
  <MainLayout title="Home">
    <Grid container spacing={4} >
      <Grid item xs={12}>
        <h1 className={styles.title}>Streamswap</h1>
        <p className={styles.description}>
          Continuous exchange of{' '}
          <a href="https://superfluid.finance" target="_blank" rel="noopener">
            Superfliud
          </a>{' '}
          streams
        </p>
      </Grid>
      <Grid item sm={6} xs={12}>
        <Link href="/exchange">
          <Card className={styles.card}>
            <CardContent>
              <h2>Exchange &rarr;</h2>
              <p>Start exchanging super tokens now!</p>
            </CardContent>
          </Card>
        </Link>
      </Grid>
      <Grid item sm={6} xs={12}>
        <Card className={styles.card}>
          <CardContent>
            <h2>Create Exchange &rarr;</h2>
            <p>Create a new super token exchange.</p>
          </CardContent>
        </Card>
      </Grid>
      <Grid item sm={6} xs={12}>
        <Card className={styles.card}>
          <CardContent>
            <h2>Documentation &rarr;</h2>
            <p>Learn about the inner workings of Streamswap.</p>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </MainLayout>
);
