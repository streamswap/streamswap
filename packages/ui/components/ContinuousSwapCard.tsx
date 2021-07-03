import { Card, IconButton, CardActions, CardContent, Grid } from '@material-ui/core';
import { ContinuousSwap } from '../queries/streamswap';
import T from '@material-ui/core/Typography';

import EditIcon from '@material-ui/icons/Edit';
import ClearIcon from '@material-ui/icons/Clear';
import ArrowIcon from '@material-ui/icons/ArrowRight';
import { useRouter } from 'next/router';
import Wei from '@synthetixio/wei';

import { TimePeriod } from '../utils/time';

export interface ContinuousSwapCardProps {
    continuousSwap: ContinuousSwap
    ratePeriod?: keyof typeof TimePeriod
    showActions?: boolean
    onCancel?: (cancelledSwap: ContinuousSwap) => void
}

const ContinuousSwapCard = ({ continuousSwap, ratePeriod = 'week', showActions = true, onCancel = () => {} }: ContinuousSwapCardProps) => {
    const router = useRouter();

    function openEdit() {
        router.push({
            pathname: '/swap',
            query: {
                inToken: continuousSwap.tokenIn.id,
                outToken: continuousSwap.tokenOut.id
            }
        });
    }

    const rateInWei = new Wei(continuousSwap.rateIn);
    const rateOutWei = new Wei(continuousSwap.currentRateOut);

    console.log(rateInWei, rateOutWei);

    return (
        <Card style={{margin: '10px', width: '300px'}}>
            <CardContent>
                <Grid container>
                    <Grid direction="column" container xs={5}>
                        <T variant="body2" align="right" aria-label={continuousSwap.tokenIn.name}>{continuousSwap.tokenIn.symbol}</T>
                        <T variant="h6" align="right">{rateInWei.mul(TimePeriod[ratePeriod]).toString(2)} / {ratePeriod}</T>
                    </Grid>
                    <Grid container xs={2} justify="center" alignItems="center">
                        <ArrowIcon fontSize="large" />
                    </Grid>
                    <Grid direction="column" container xs={5}>
                        <T variant="body2" aria-label={continuousSwap.tokenOut.name}>{continuousSwap.tokenOut.symbol}</T>
                        <T variant="h6">{rateOutWei.mul(TimePeriod[ratePeriod]).toString(2)} / {ratePeriod}</T>
                    </Grid>
                </Grid>
            </CardContent>
            {showActions && <CardActions style={{justifyContent:'right'}}>
                <IconButton aria-label="edit" onClick={openEdit}>
                    <EditIcon />
                </IconButton>
                <IconButton aria-label="cancel" onClick={() => onCancel(continuousSwap)}>
                    <ClearIcon />
                </IconButton>
            </CardActions>}
        </Card>
    );
} 

export default ContinuousSwapCard;
