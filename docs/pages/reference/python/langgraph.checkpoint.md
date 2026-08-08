<!-- langgraph-docs: langgraph.checkpoint | https://reference.langchain.com/python/langgraph.checkpoint.md -->

# langgraph.checkpoint

> Python package

📖 [View in docs](https://reference.langchain.com/python/langgraph.checkpoint)

## Classes

- [`CheckpointMetadata`](https://reference.langchain.com/python/langgraph.checkpoint/base/CheckpointMetadata)
- [`Checkpoint`](https://reference.langchain.com/python/langgraph.checkpoint/base/Checkpoint)
- [`CheckpointTuple`](https://reference.langchain.com/python/langgraph.checkpoint/base/CheckpointTuple)
- [`DeltaChannelHistory`](https://reference.langchain.com/python/langgraph.checkpoint/base/DeltaChannelHistory)
- [`BaseCheckpointSaver`](https://reference.langchain.com/python/langgraph.checkpoint/base/BaseCheckpointSaver)
- [`EmptyChannelError`](https://reference.langchain.com/python/langgraph.checkpoint/base/EmptyChannelError)
- [`UUID`](https://reference.langchain.com/python/langgraph.checkpoint/base/id/UUID)
- [`SerdeEvent`](https://reference.langchain.com/python/langgraph.checkpoint/serde/event_hooks/SerdeEvent)
- [`ChannelProtocol`](https://reference.langchain.com/python/langgraph.checkpoint/serde/types/ChannelProtocol)
- [`SendProtocol`](https://reference.langchain.com/python/langgraph.checkpoint/serde/types/SendProtocol)
- [`EncryptedSerializer`](https://reference.langchain.com/python/langgraph.checkpoint/serde/encrypted/EncryptedSerializer)
- [`JsonPlusSerializer`](https://reference.langchain.com/python/langgraph.checkpoint/serde/jsonplus/JsonPlusSerializer)
- [`InvalidModuleError`](https://reference.langchain.com/python/langgraph.checkpoint/serde/jsonplus/InvalidModuleError)
- [`UntypedSerializerProtocol`](https://reference.langchain.com/python/langgraph.checkpoint/serde/base/UntypedSerializerProtocol)
- [`SerializerProtocol`](https://reference.langchain.com/python/langgraph.checkpoint/serde/base/SerializerProtocol)
- [`SerializerCompat`](https://reference.langchain.com/python/langgraph.checkpoint/serde/base/SerializerCompat)
- [`CipherProtocol`](https://reference.langchain.com/python/langgraph.checkpoint/serde/base/CipherProtocol)
- [`InMemorySaver`](https://reference.langchain.com/python/langgraph.checkpoint/memory/InMemorySaver)
- [`PersistentDict`](https://reference.langchain.com/python/langgraph.checkpoint/memory/PersistentDict)

## Functions

- [`copy_checkpoint()`](https://reference.langchain.com/python/langgraph.checkpoint/base/copy_checkpoint)
- [`get_checkpoint_id()`](https://reference.langchain.com/python/langgraph.checkpoint/base/get_checkpoint_id)
- [`get_checkpoint_metadata()`](https://reference.langchain.com/python/langgraph.checkpoint/base/get_checkpoint_metadata)
- [`get_serializable_checkpoint_metadata()`](https://reference.langchain.com/python/langgraph.checkpoint/base/get_serializable_checkpoint_metadata)
- [`empty_checkpoint()`](https://reference.langchain.com/python/langgraph.checkpoint/base/empty_checkpoint)
- [`create_checkpoint()`](https://reference.langchain.com/python/langgraph.checkpoint/base/create_checkpoint)
- [`uuid6()`](https://reference.langchain.com/python/langgraph.checkpoint/base/id/uuid6)
- [`register_serde_event_listener()`](https://reference.langchain.com/python/langgraph.checkpoint/serde/event_hooks/register_serde_event_listener)
- [`emit_serde_event()`](https://reference.langchain.com/python/langgraph.checkpoint/serde/event_hooks/emit_serde_event)
- [`maybe_add_typed_methods()`](https://reference.langchain.com/python/langgraph.checkpoint/serde/base/maybe_add_typed_methods)