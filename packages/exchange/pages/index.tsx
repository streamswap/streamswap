import Link from 'next/link';
import styles from '../styles/Home.module.css';
import MainLayout from '../components/MainLayout';
import Card from '@material-ui/core/Card';
import Grid from '@material-ui/core/Grid';
import CardContent from '@material-ui/core/CardContent';
import T from '@material-ui/core/Typography';

/** Home */
export default () => (
  <MainLayout title="Home">
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <T className={styles.title} variant="h1">
          Streamswap
        </T>
        <T className={styles.description} variant="subtitle1" component="p">
          Continuous exchange of{' '}
          <a href="https://superfluid.finance" target="_blank" rel="noopener">
            Superfliud
          </a>{' '}
          streams
        </T>
      </Grid>
      <Grid item md={6} xs={12}>
        <Link href="/exchange">
          <Card className={styles.card}>
            <CardContent>
              <T variant="h4">Exchange&nbsp;&rarr;</T>
              <T variant="body1">Start exchanging super tokens now!</T>
            </CardContent>
          </Card>
        </Link>
      </Grid>
      <Grid item md={6} xs={12}>
        <Card className={styles.card}>
          <CardContent>
            <T variant="h4">Create Exchange&nbsp;&rarr;</T>
            <T variant="body1">Create a new super token exchange.</T>
          </CardContent>
        </Card>
      </Grid>
      <Grid item md={6} xs={12}>
        <Card className={styles.card}>
          <CardContent>
            <T variant="h4">Documentation&nbsp;&rarr;</T>
            <T variant="body1">Learn about the inner workings of Streamswap.</T>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </MainLayout>
);
