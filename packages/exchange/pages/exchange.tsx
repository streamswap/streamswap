import styles from '../styles/Exchange.module.css';
import MainLayout from '../components/MainLayout';

import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';

export default () => (
  <MainLayout title="Exchange">
    <h2>Exchange</h2>
    <div className={styles.exchange}>
      <h3>From</h3>

      <h3>To</h3>
    </div>
  </MainLayout>
);
