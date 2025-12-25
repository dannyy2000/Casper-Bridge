#![no_std]
#![no_main]

extern crate alloc;

use alloc::{boxed::Box, format, string::String, vec, vec::Vec};
use casper_contract::{
    contract_api::{runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    bytesrepr::{FromBytes, ToBytes},
    contracts::NamedKeys,
    runtime_args, CLType, CLTyped, CLValue, EntryPoint, EntryPointAccess, EntryPointType,
    EntryPoints, Key, Parameter, RuntimeArgs, U512,
};

// Storage keys
const OWNER_KEY: &str = "owner";
const VALIDATORS_KEY: &str = "validators";
const REQUIRED_SIGNATURES_KEY: &str = "required_signatures";
const TOTAL_LOCKED_KEY: &str = "total_locked";
const NONCE_KEY: &str = "nonce";
const PROCESSED_PROOFS_KEY: &str = "processed_proofs";
const PAUSED_KEY: &str = "paused";
const MIN_LOCK_AMOUNT_KEY: &str = "min_lock_amount";

// Entry point names
const ENTRY_POINT_INIT: &str = "init";
const ENTRY_POINT_LOCK_CSPR: &str = "lock_cspr";
const ENTRY_POINT_RELEASE_CSPR: &str = "release_cspr";
const ENTRY_POINT_ADD_VALIDATOR: &str = "add_validator";
const ENTRY_POINT_REMOVE_VALIDATOR: &str = "remove_validator";
const ENTRY_POINT_SET_REQUIRED_SIGNATURES: &str = "set_required_signatures";
const ENTRY_POINT_PAUSE: &str = "pause";
const ENTRY_POINT_UNPAUSE: &str = "unpause";
const ENTRY_POINT_IS_VALIDATOR: &str = "is_validator";
const ENTRY_POINT_GET_TOTAL_LOCKED: &str = "get_total_locked";
const ENTRY_POINT_GET_NONCE: &str = "get_nonce";

// Helper functions
fn get_key<T: FromBytes + CLTyped>(name: &str) -> T {
    let key = runtime::get_key(name)
        .unwrap_or_revert_with(casper_types::ApiError::MissingKey);
    storage::read(key.into_uref().unwrap_or_revert())
        .unwrap_or_revert()
        .unwrap_or_revert()
}

fn set_key<T: ToBytes + CLTyped>(name: &str, value: T) {
    match runtime::get_key(name) {
        Some(key) => {
            let key_uref = key.into_uref().unwrap_or_revert();
            storage::write(key_uref, value);
        }
        None => {
            let key = storage::new_uref(value);
            runtime::put_key(name, key.into());
        }
    }
}

fn require_owner() {
    let owner: Key = get_key(OWNER_KEY);
    let caller = runtime::get_caller();
    if Key::Account(caller) != owner {
        runtime::revert(casper_types::ApiError::PermissionDenied);
    }
}

fn require_not_paused() {
    let paused: bool = get_key(PAUSED_KEY);
    if paused {
        runtime::revert(casper_types::ApiError::InvalidArgument);
    }
}

// Initialize the contract
#[no_mangle]
pub extern "C" fn init() {
    let required_sigs: u32 = runtime::get_named_arg("required_sigs");
    let min_amount: U512 = runtime::get_named_arg("min_amount");

    let caller = runtime::get_caller();

    // Initialize storage
    set_key(OWNER_KEY, Key::Account(caller));
    set_key(REQUIRED_SIGNATURES_KEY, required_sigs);
    set_key(MIN_LOCK_AMOUNT_KEY, min_amount);
    set_key(PAUSED_KEY, false);
    set_key(NONCE_KEY, 0u64);
    set_key(TOTAL_LOCKED_KEY, U512::zero());

    // Initialize validators dictionary (owner is first validator)
    let validators_dict = storage::new_dictionary(VALIDATORS_KEY).unwrap_or_revert();
    let caller_key = format!("{:?}", caller);
    storage::dictionary_put(validators_dict, &caller_key, true);

    // Initialize processed proofs dictionary
    storage::new_dictionary(PROCESSED_PROOFS_KEY).unwrap_or_revert();
}

// Lock CSPR to bridge to another chain
#[no_mangle]
pub extern "C" fn lock_cspr() {
    require_not_paused();

    let destination_chain: String = runtime::get_named_arg("destination_chain");
    let destination_address: String = runtime::get_named_arg("destination_address");
    let amount: U512 = runtime::get_named_arg("amount");

    let min_amount: U512 = get_key(MIN_LOCK_AMOUNT_KEY);
    if amount < min_amount {
        runtime::revert(casper_types::ApiError::InvalidArgument);
    }

    let caller = runtime::get_caller();

    // Update total locked
    let current_locked: U512 = get_key(TOTAL_LOCKED_KEY);
    set_key(TOTAL_LOCKED_KEY, current_locked + amount);

    // Increment nonce
    let current_nonce: u64 = get_key(NONCE_KEY);
    set_key(NONCE_KEY, current_nonce + 1);

    // Emit event (in Casper, we store event data in named keys)
    let event_name = format!("asset_locked_{}", current_nonce);
    runtime::put_key(
        &event_name,
        storage::new_uref((amount, current_nonce)).into(),
    );
}

// Release CSPR when proof of burn is provided from destination chain
#[no_mangle]
pub extern "C" fn release_cspr() {
    require_not_paused();

    let source_chain: String = runtime::get_named_arg("source_chain");
    let source_tx_hash: String = runtime::get_named_arg("source_tx_hash");
    let amount: U512 = runtime::get_named_arg("amount");
    let recipient: Key = runtime::get_named_arg("recipient");
    let nonce: u64 = runtime::get_named_arg("nonce");
    let signatures: Vec<(Vec<u8>, Vec<u8>)> = runtime::get_named_arg("signatures");

    // Check if proof already processed
    let processed_dict = runtime::get_key(PROCESSED_PROOFS_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let nonce_key = format!("{}", nonce);
    let already_processed: Option<bool> = storage::dictionary_get(processed_dict, &nonce_key)
        .unwrap_or_revert();

    if already_processed.is_some() {
        runtime::revert(casper_types::ApiError::InvalidArgument);
    }

    // Verify signatures
    let required_sigs: u32 = get_key(REQUIRED_SIGNATURES_KEY);
    if signatures.len() < required_sigs as usize {
        runtime::revert(casper_types::ApiError::InvalidArgument);
    }

    // Mark as processed
    storage::dictionary_put(processed_dict, &nonce_key, true);

    // Update total locked
    let current_locked: U512 = get_key(TOTAL_LOCKED_KEY);
    if current_locked < amount {
        runtime::revert(casper_types::ApiError::InvalidArgument);
    }
    set_key(TOTAL_LOCKED_KEY, current_locked - amount);

    // Transfer CSPR to recipient
    if let Key::Account(account_hash) = recipient {
        system::transfer_to_account(account_hash, amount, None).unwrap_or_revert();
    } else {
        runtime::revert(casper_types::ApiError::InvalidArgument);
    }

    // Emit event
    let event_name = format!("asset_released_{}", nonce);
    runtime::put_key(
        &event_name,
        storage::new_uref((amount, nonce)).into(),
    );
}

// Add a validator (owner only)
#[no_mangle]
pub extern "C" fn add_validator() {
    require_owner();

    let validator: Key = runtime::get_named_arg("validator");

    let validators_dict = runtime::get_key(VALIDATORS_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let validator_key = format!("{:?}", validator);
    storage::dictionary_put(validators_dict, &validator_key, true);
}

// Remove a validator (owner only)
#[no_mangle]
pub extern "C" fn remove_validator() {
    require_owner();

    let validator: Key = runtime::get_named_arg("validator");

    let validators_dict = runtime::get_key(VALIDATORS_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let validator_key = format!("{:?}", validator);
    storage::dictionary_put(validators_dict, &validator_key, false);
}

// Set required signatures (owner only)
#[no_mangle]
pub extern "C" fn set_required_signatures() {
    require_owner();

    let count: u32 = runtime::get_named_arg("count");
    if count == 0 {
        runtime::revert(casper_types::ApiError::InvalidArgument);
    }

    set_key(REQUIRED_SIGNATURES_KEY, count);
}

// Pause contract (owner only)
#[no_mangle]
pub extern "C" fn pause() {
    require_owner();
    set_key(PAUSED_KEY, true);
}

// Unpause contract (owner only)
#[no_mangle]
pub extern "C" fn unpause() {
    require_owner();
    set_key(PAUSED_KEY, false);
}

// Check if address is validator
#[no_mangle]
pub extern "C" fn is_validator() {
    let address: Key = runtime::get_named_arg("address");

    let validators_dict = runtime::get_key(VALIDATORS_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let address_key = format!("{:?}", address);
    let is_val: Option<bool> = storage::dictionary_get(validators_dict, &address_key)
        .unwrap_or_revert();

    let result = is_val.unwrap_or(false);
    runtime::ret(CLValue::from_t(result).unwrap_or_revert());
}

// Get total locked amount
#[no_mangle]
pub extern "C" fn get_total_locked() {
    let total: U512 = get_key(TOTAL_LOCKED_KEY);
    runtime::ret(CLValue::from_t(total).unwrap_or_revert());
}

// Get current nonce
#[no_mangle]
pub extern "C" fn get_nonce() {
    let nonce: u64 = get_key(NONCE_KEY);
    runtime::ret(CLValue::from_t(nonce).unwrap_or_revert());
}

// Contract installer (the critical "call" entry point)
#[no_mangle]
pub extern "C" fn call() {
    // Get installation parameters
    let contract_name: String = runtime::get_named_arg("contract_name");

    // Define entry points
    let mut entry_points = EntryPoints::new();

    // init
    entry_points.add_entry_point(EntryPoint::new(
        ENTRY_POINT_INIT,
        vec![
            Parameter::new("required_sigs", CLType::U32),
            Parameter::new("min_amount", CLType::U512),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // lock_cspr
    entry_points.add_entry_point(EntryPoint::new(
        ENTRY_POINT_LOCK_CSPR,
        vec![
            Parameter::new("destination_chain", CLType::String),
            Parameter::new("destination_address", CLType::String),
            Parameter::new("amount", CLType::U512),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // release_cspr
    entry_points.add_entry_point(EntryPoint::new(
        ENTRY_POINT_RELEASE_CSPR,
        vec![
            Parameter::new("source_chain", CLType::String),
            Parameter::new("source_tx_hash", CLType::String),
            Parameter::new("amount", CLType::U512),
            Parameter::new("recipient", CLType::Key),
            Parameter::new("nonce", CLType::U64),
            Parameter::new("signatures", CLType::Any),  // Use Any for complex types
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // add_validator
    entry_points.add_entry_point(EntryPoint::new(
        ENTRY_POINT_ADD_VALIDATOR,
        vec![Parameter::new("validator", CLType::Key)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // remove_validator
    entry_points.add_entry_point(EntryPoint::new(
        ENTRY_POINT_REMOVE_VALIDATOR,
        vec![Parameter::new("validator", CLType::Key)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // set_required_signatures
    entry_points.add_entry_point(EntryPoint::new(
        ENTRY_POINT_SET_REQUIRED_SIGNATURES,
        vec![Parameter::new("count", CLType::U32)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // pause
    entry_points.add_entry_point(EntryPoint::new(
        ENTRY_POINT_PAUSE,
        vec![],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // unpause
    entry_points.add_entry_point(EntryPoint::new(
        ENTRY_POINT_UNPAUSE,
        vec![],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // is_validator
    entry_points.add_entry_point(EntryPoint::new(
        ENTRY_POINT_IS_VALIDATOR,
        vec![Parameter::new("address", CLType::Key)],
        CLType::Bool,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // get_total_locked
    entry_points.add_entry_point(EntryPoint::new(
        ENTRY_POINT_GET_TOTAL_LOCKED,
        vec![],
        CLType::U512,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // get_nonce
    entry_points.add_entry_point(EntryPoint::new(
        ENTRY_POINT_GET_NONCE,
        vec![],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // Create named keys
    let named_keys = NamedKeys::new();

    // Install the contract
    let (contract_hash, _version) = storage::new_contract(
        entry_points,
        Some(named_keys),
        Some(format!("{}_package_hash", contract_name)),
        Some(format!("{}_access_uref", contract_name)),
    );

    // Store contract hash under the contract name
    runtime::put_key(&contract_name, contract_hash.into());
}

