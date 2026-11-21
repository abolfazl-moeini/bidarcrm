<?php

declare( strict_types=1 );

namespace WPDevTest\Woocommerce\Builder;

use WC_Product;
use WC_Product_Simple;
use WC_Product_External;
use WC_Product_Grouped;
use WC_Product_Variable;
use WC_Product_Variation;
use WC_Product_Attribute;

/**
 * Fluent builder for creating WooCommerce products with a single save.
 */
class ProductBuilder extends AbstractBuilder {

	protected string $type = 'simple';
	protected string $name = 'Test Product';
	protected float $regular_price = 20.0;
	protected ?float $sale_price = null;
	protected string $sku = '';
	protected bool $manage_stock = false;
	protected int $stock_quantity = 0;
	protected string $stock_status = 'instock';
	protected bool $virtual = false;
	protected bool $downloadable = false;
	protected array $attributes = array();
	protected array $props = array();

	/** @var array<array{sku: string, price: float, attributes: array}> */
	protected array $variations = array();

	public function named( string $name ): self {
		$this->name = $name;
		return $this;
	}

	public function priced( float $regular, ?float $sale = null ): self {
		$this->regular_price = $regular;
		$this->sale_price    = $sale;
		return $this;
	}

	public function sku( string $sku ): self {
		$this->sku = $sku;
		return $this;
	}

	public function inStock( int $qty = 10, bool $manage = false ): self {
		$this->stock_status   = 'instock';
		$this->manage_stock   = $manage;
		$this->stock_quantity = $qty;
		return $this;
	}

	public function outOfStock(): self {
		$this->stock_status = 'outofstock';
		return $this;
	}

	public function virtual( bool $is_virtual = true ): self {
		$this->virtual = $is_virtual;
		return $this;
	}

	public function downloadable( bool $is_downloadable = true ): self {
		$this->downloadable = $is_downloadable;
		return $this;
	}

	public function external(): self {
		$this->type = 'external';
		return $this;
	}

	public function grouped(): self {
		$this->type = 'grouped';
		return $this;
	}

	public function variable(): self {
		$this->type = 'variable';
		return $this;
	}

	public function withAttribute( string $name, array $options, bool $is_variation = false ): self {
		$attribute = new WC_Product_Attribute();
		$attribute->set_name( $name );
		$attribute->set_options( $options );
		$attribute->set_position( count( $this->attributes ) );
		$attribute->set_visible( true );
		$attribute->set_variation( $is_variation );
		$this->attributes[] = $attribute;
		return $this;
	}

	public function withProps( array $props ): self {
		$this->props = array_merge( $this->props, $props );
		return $this;
	}

	public function withVariation( string $sku, float $price, array $attributes = array() ): self {
		$this->variations[] = array(
			'sku'        => $sku,
			'price'      => $price,
			'attributes' => $attributes,
		);
		$this->type = 'variable';
		return $this;
	}

	/**
	 * Build the product instance without persisting to database.
	 *
	 * @return WC_Product
	 */
	public function build(): WC_Product {
		switch ( $this->type ) {
			case 'external':
				$product = new WC_Product_External();
				break;
			case 'grouped':
				$product = new WC_Product_Grouped();
				break;
			case 'variable':
				$product = new WC_Product_Variable();
				break;
			case 'simple':
			default:
				$product = new WC_Product_Simple();
				break;
		}

		$sku = '' !== $this->sku ? $this->sku : 'TEST-SKU-' . ( function_exists( 'wp_rand' ) ? wp_rand( 1000, 999999 ) : mt_rand( 1000, 999999 ) );

		$default_props = array(
			'name'          => $this->name,
			'regular_price' => (string) $this->regular_price,
			'price'         => (string) ( null !== $this->sale_price ? $this->sale_price : $this->regular_price ),
			'sku'           => $sku,
			'manage_stock'  => $this->manage_stock,
			'stock_status'  => $this->stock_status,
			'virtual'       => $this->virtual,
			'downloadable'  => $this->downloadable,
			'tax_status'    => 'taxable',
		);

		if ( null !== $this->sale_price ) {
			$default_props['sale_price'] = (string) $this->sale_price;
		}

		if ( $this->manage_stock ) {
			$default_props['stock_quantity'] = $this->stock_quantity;
		}

		$product->set_props( array_merge( $default_props, $this->props ) );

		if ( ! empty( $this->attributes ) ) {
			$product->set_attributes( $this->attributes );
		}

		return $product;
	}

	/**
	 * Build and save the product.
	 *
	 * @return WC_Product
	 */
	public function create(): WC_Product {
		$product = $this->build();
		$product->save();

		if ( 'variable' === $this->type && ! empty( $this->variations ) && class_exists( 'WC_Product_Variation' ) ) {
			$variation_ids = array();
			foreach ( $this->variations as $var_data ) {
				$variation = new WC_Product_Variation();
				$variation->set_props(
					array(
						'parent_id'     => $product->get_id(),
						'sku'           => $var_data['sku'],
						'regular_price' => (string) $var_data['price'],
					)
				);
				if ( ! empty( $var_data['attributes'] ) ) {
					$variation->set_attributes( $var_data['attributes'] );
				}
				$variation->save();
				$variation_ids[] = $variation->get_id();
			}
			$product->set_children( $variation_ids );
			$product->save();
		}

		return $product;
	}
}
