#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Funded,
    Released,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Job {
    pub id: u64,
    pub client: Address,
    pub provider: Address,
    pub token: Address,
    pub amount: i128,
    pub title: String,
    pub status: Status,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    NextJobId,
    Job(u64),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    InvalidAmount = 1,
    MissingJob = 2,
    NotFunded = 3,
}

#[contractevent(topics = ["escrow", "created"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JobCreated {
    #[topic]
    pub id: u64,
    pub amount: i128,
}

#[contractevent(topics = ["escrow", "released"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JobReleased {
    #[topic]
    pub id: u64,
    pub amount: i128,
}

#[contractevent(topics = ["escrow", "cancelled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JobCancelled {
    #[topic]
    pub id: u64,
    pub amount: i128,
}

#[contract]
pub struct ServiceEscrow;

#[contractimpl]
impl ServiceEscrow {
    pub fn create_job(
        env: Env,
        client: Address,
        provider: Address,
        token: Address,
        amount: i128,
        title: String,
    ) -> Result<u64, EscrowError> {
        client.require_auth();

        if amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        }

        let id = Self::next_id(&env);
        let contract = env.current_contract_address();
        token::Client::new(&env, &token).transfer(&client, &contract, &amount);

        let job = Job {
            id,
            client,
            provider,
            token,
            amount,
            title,
            status: Status::Funded,
        };

        env.storage().persistent().set(&DataKey::Job(id), &job);
        JobCreated {
            id,
            amount: job.amount,
        }
        .publish(&env);
        Ok(id)
    }

    pub fn release(env: Env, job_id: u64) -> Result<(), EscrowError> {
        let mut job = Self::load_funded_job(&env, job_id)?;
        job.client.require_auth();

        let contract = env.current_contract_address();
        token::Client::new(&env, &job.token).transfer(&contract, &job.provider, &job.amount);

        job.status = Status::Released;
        env.storage().persistent().set(&DataKey::Job(job_id), &job);
        JobReleased {
            id: job_id,
            amount: job.amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn cancel(env: Env, job_id: u64) -> Result<(), EscrowError> {
        let mut job = Self::load_funded_job(&env, job_id)?;
        job.client.require_auth();

        let contract = env.current_contract_address();
        token::Client::new(&env, &job.token).transfer(&contract, &job.client, &job.amount);

        job.status = Status::Cancelled;
        env.storage().persistent().set(&DataKey::Job(job_id), &job);
        JobCancelled {
            id: job_id,
            amount: job.amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_job(env: Env, job_id: u64) -> Result<Job, EscrowError> {
        env.storage()
            .persistent()
            .get(&DataKey::Job(job_id))
            .ok_or(EscrowError::MissingJob)
    }

    fn next_id(env: &Env) -> u64 {
        let id = env
            .storage()
            .persistent()
            .get(&DataKey::NextJobId)
            .unwrap_or(1_u64);
        env.storage()
            .persistent()
            .set(&DataKey::NextJobId, &(id + 1));
        id
    }

    fn load_funded_job(env: &Env, job_id: u64) -> Result<Job, EscrowError> {
        let job: Job = env
            .storage()
            .persistent()
            .get(&DataKey::Job(job_id))
            .ok_or(EscrowError::MissingJob)?;

        if job.status != Status::Funded {
            return Err(EscrowError::NotFunded);
        }

        Ok(job)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::StellarAssetClient,
    };

    fn setup() -> (
        Env,
        ServiceEscrowClient<'static>,
        token::Client<'static>,
        Address,
        Address,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|ledger| ledger.sequence_number = 100);

        let contract_id = env.register(ServiceEscrow, ());
        let client = ServiceEscrowClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let token_address = env.register_stellar_asset_contract_v2(admin).address();
        let asset = StellarAssetClient::new(&env, &token_address);
        let token = token::Client::new(&env, &token_address);
        let buyer = Address::generate(&env);
        let provider = Address::generate(&env);

        asset.mint(&buyer, &1_000_000);
        (env, client, token, buyer, provider)
    }

    #[test]
    fn create_job_locks_funds_in_contract() {
        let (env, escrow, token, buyer, provider) = setup();
        let contract = escrow.address.clone();

        let job_id = escrow
            .try_create_job(
                &buyer,
                &provider,
                &token.address,
                &250_000,
                &String::from_str(&env, "Landing page audit"),
            )
            .unwrap()
            .unwrap();

        let job = escrow.try_get_job(&job_id).unwrap().unwrap();
        assert_eq!(job.status, Status::Funded);
        assert_eq!(job.amount, 250_000);
        assert_eq!(token.balance(&contract), 250_000);
        assert_eq!(token.balance(&buyer), 750_000);
    }

    #[test]
    fn release_pays_provider() {
        let (env, escrow, token, buyer, provider) = setup();

        let job_id = escrow
            .create_job(
                &buyer,
                &provider,
                &token.address,
                &125_000,
                &String::from_str(&env, "Invoice translation"),
            );

        escrow.release(&job_id);

        let job = escrow.get_job(&job_id);
        assert_eq!(job.status, Status::Released);
        assert_eq!(token.balance(&provider), 125_000);
        assert_eq!(token.balance(&escrow.address), 0);
    }

    #[test]
    fn cancel_refunds_client_and_blocks_second_action() {
        let (env, escrow, token, buyer, provider) = setup();

        let job_id = escrow
            .create_job(
                &buyer,
                &provider,
                &token.address,
                &300_000,
                &String::from_str(&env, "Logo cleanup"),
            );

        escrow.cancel(&job_id);

        let job = escrow.get_job(&job_id);
        assert_eq!(job.status, Status::Cancelled);
        assert_eq!(token.balance(&buyer), 1_000_000);
        assert_eq!(
            escrow.try_release(&job_id).unwrap_err().unwrap(),
            EscrowError::NotFunded
        );
    }

    #[test]
    fn rejects_zero_amount_jobs() {
        let (env, escrow, token, buyer, provider) = setup();

        let result = escrow.try_create_job(
            &buyer,
            &provider,
            &token.address,
            &0,
            &String::from_str(&env, "Bad job"),
        );

        assert_eq!(result.unwrap_err().unwrap(), EscrowError::InvalidAmount);
    }
}
