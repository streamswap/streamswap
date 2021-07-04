import { Card, CardContent, Grid } from '@material-ui/core';
import T from '@material-ui/core/Typography';

import Wei from '@synthetixio/wei';
import { Balance } from '../queries/streamswap';

export interface BalanceCardProps {
    balance: Balance
}

const BalanceCard = ({ balance }: BalanceCardProps) => {

    const liveBalance = new Wei(0);

    return (
        <Card style={{margin: '10px', width: '100px', height: '30px'}}>
            <CardContent>
                <Grid container>
                    <T>{balance.token.symbol}</T><T>{liveBalance}</T>
                </Grid>
            </CardContent>
        </Card>
    );
} 

export default BalanceCard;
