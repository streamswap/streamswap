import { Card, CardContent, Grid } from '@material-ui/core';
import T from '@material-ui/core/Typography';

import Wei from '@synthetixio/wei';
import React from 'react';
import { useState } from 'react';
import { Balance } from '../queries/<my project>';

export interface BalanceCardProps {
    balance: Balance
}

class BalanceCard extends React.Component<BalanceCardProps, {curTime: number}> {

    interval: any;

    constructor(props: BalanceCardProps) {
        super(props);
        this.state = {
            curTime: Date.now() / 1000
        }
    }

    tick() {
        this.setState({
            curTime: Date.now() / 1000
        })
    }

    componentDidMount() {
        this.interval = setInterval(() => this.tick(), 100);
    }

    componentWillUnmount() {
        clearInterval(this.interval);
    }

    render() {
        const liveBalance = new Wei(this.state.curTime - this.props.balance.lastAction).mul(this.props.balance.netFlow).add(this.props.balance.balance);
    
        return (
            <Card style={{margin: '10px', width: '300px', height: '60px'}}>
                <CardContent>
                    <Grid container justify="space-between">
                        <T>{this.props.balance.token.symbol}</T><T>{liveBalance.toString(6)}</T>
                    </Grid>
                </CardContent>
            </Card>
        );
    }
}

export default BalanceCard;
